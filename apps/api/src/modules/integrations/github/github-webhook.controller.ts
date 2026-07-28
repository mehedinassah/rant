import {
  BadRequestException,
  Controller,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { GithubConfig } from './github.config';
import { GithubWebhookService } from './github-webhook.service';
import { GITHUB_EVENTS_QUEUE } from './github.constants';

export interface GithubJobData {
  event: string;
  deliveryId: string;
  payload: Record<string, unknown>;
}

/**
 * Inbound GitHub webhook receiver. Does the minimum synchronously — verify the
 * signature, dedupe the delivery, enqueue a job — and returns 200 immediately.
 * All mapping happens in the processor (G4) so GitHub's retries stay cheap.
 */
@Controller('integrations/github')
export class GithubWebhookController {
  constructor(
    private readonly config: GithubConfig,
    private readonly webhook: GithubWebhookService,
    @InjectQueue(GITHUB_EVENTS_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean; queued?: boolean }> {
    if (!this.config.isEnabled()) {
      // Integration off: accept + ignore so GitHub doesn't hammer retries.
      return { ok: true, queued: false };
    }

    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing body');

    const signature = req.header('x-hub-signature-256');
    if (!this.webhook.verifySignature(raw, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const event = req.header('x-github-event') ?? 'unknown';
    const deliveryId = req.header('x-github-delivery') ?? '';

    const fresh = await this.webhook.claimDelivery(deliveryId, event);
    if (!fresh) return { ok: true, queued: false }; // duplicate delivery

    if (event === 'ping') return { ok: true, queued: false };

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    await this.queue.add(
      event,
      { event, deliveryId, payload } satisfies GithubJobData,
      { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    return { ok: true, queued: true };
  }
}
