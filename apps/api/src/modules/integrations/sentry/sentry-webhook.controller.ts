import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
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
import { SentryConfig } from './sentry.config';
import { SentryWebhookService } from './sentry-webhook.service';
import {
  SENTRY_EVENTS_QUEUE,
  SENTRY_RESOURCE_HEADER,
  SENTRY_SIGNATURE_HEADER,
} from './sentry.constants';
import type { SentryWebhookPayload } from './sentry.mappers';

export interface SentryJobData {
  event: string;
  resource: string;
  deliveryId: string;
  payload: SentryWebhookPayload;
}

/**
 * Inbound Sentry webhook receiver (Integration Platform). Verifies the
 * `sentry-hook-signature`, dedupes, and enqueues issue events for mapping.
 */
@Controller('integrations/sentry')
export class SentryWebhookController {
  constructor(
    private readonly config: SentryConfig,
    private readonly webhook: SentryWebhookService,
    @InjectQueue(SENTRY_EVENTS_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean; queued?: boolean }> {
    if (!this.config.isEnabled()) {
      return { ok: true, queued: false };
    }

    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing body');

    const signature = req.header(SENTRY_SIGNATURE_HEADER);
    if (!this.webhook.verifySignature(raw, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    let payload: SentryWebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as SentryWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    const resource = req.header(SENTRY_RESOURCE_HEADER) ?? payload.resource ?? 'unknown';
    const event = `${resource}:${payload.action ?? 'unknown'}`;
    const deliveryId =
      req.header('request-id') ||
      req.header('x-request-id') ||
      createHash('sha256').update(raw).digest('hex');
    const rawProjectId =
      payload?.data?.issue?.project?.id ?? payload?.data?.issue?.project?.slug;
    const externalProjectId =
      rawProjectId === undefined || rawProjectId === null ? null : String(rawProjectId);

    const fresh = await this.webhook.claimDelivery(deliveryId, event, externalProjectId);
    if (!fresh) return { ok: true, queued: false };

    await this.queue.add(event, { event, resource, deliveryId, payload } satisfies SentryJobData, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return { ok: true, queued: true };
  }
}
