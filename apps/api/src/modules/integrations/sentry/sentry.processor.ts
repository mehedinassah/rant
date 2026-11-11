import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SENTRY_EVENTS_QUEUE } from './sentry.constants';
import { SentryConfig } from './sentry.config';
import { SentryIngestService } from './sentry-ingest.service';
import { normalizeSentryWebhook } from './sentry.mappers';
import type { SentryJobData } from './sentry-webhook.controller';

/**
 * Consumes verified Sentry deliveries, maps issue events onto Incident records
 * and re-emits `incident.opened` / `incident.resolved`.
 */
@Processor(SENTRY_EVENTS_QUEUE, { concurrency: 4 })
export class SentryProcessor extends WorkerHost {
  private readonly logger = new Logger('SentryWorker');

  constructor(
    private readonly config: SentryConfig,
    private readonly ingest: SentryIngestService,
  ) {
    super();
  }

  async process(job: Job<SentryJobData>): Promise<void> {
    if (!this.config.isEnabled()) return;

    const { event, resource, deliveryId, payload } = job.data;
    const normalized = normalizeSentryWebhook(resource, payload);
    if (!normalized) {
      this.logger.debug(`Ignoring unmapped Sentry event=${event} delivery=${deliveryId}`);
      return;
    }

    this.logger.log(`event=${event} issue=${normalized.issueId} project=${normalized.projectId}`);
    await this.ingest.ingestIssue(normalized);
  }
}
