import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { VercelConfig } from './vercel.config';
import { VercelWebhookService } from './vercel-webhook.service';
import { VERCEL_DELIVERY_HEADER, VERCEL_EVENTS_QUEUE, VERCEL_SIGNATURE_HEADER } from './vercel.constants';
import type { VercelWebhookPayload } from './vercel.mappers';

export interface VercelJobData {
  event: string;
  deliveryId: string;
  payload: VercelWebhookPayload;
}

/**
 * Inbound Vercel webhook receiver: verify → dedupe → enqueue → 200. Mapping
 * happens in the worker so Vercel's delivery timeout is never a concern.
 */
@Controller('integrations/vercel')
export class VercelWebhookController {
  private readonly logger = new Logger('VercelWebhook');

  constructor(
    private readonly config: VercelConfig,
    private readonly webhook: VercelWebhookService,
    @InjectQueue(VERCEL_EVENTS_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean; queued?: boolean }> {
    if (!this.config.isEnabled()) {
      // Integration off: accept + ignore so Vercel doesn't retry.
      return { ok: true, queued: false };
    }

    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing body');

    const signature = req.header(VERCEL_SIGNATURE_HEADER);
    if (!this.webhook.verifySignature(raw, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    let payload: VercelWebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as VercelWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    const event = typeof payload?.type === 'string' ? payload.type : 'unknown';
    const deliveryId =
      req.header(VERCEL_DELIVERY_HEADER) ||
      createHash('sha256').update(raw).digest('hex');
    const externalProjectId = payload?.payload?.project?.id
      ? String(payload.payload.project.id)
      : null;

    const fresh = await this.webhook.claimDelivery(deliveryId, event, externalProjectId);
    if (!fresh) return { ok: true, queued: false };

    await this.queue.add(event, { event, deliveryId, payload } satisfies VercelJobData, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return { ok: true, queued: true };
  }
}
