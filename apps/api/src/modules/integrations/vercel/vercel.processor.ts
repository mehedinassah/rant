import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VERCEL_EVENTS_QUEUE } from './vercel.constants';
import { VercelConfig } from './vercel.config';
import { VercelIngestService } from './vercel-ingest.service';
import { normalizeVercelWebhook } from './vercel.mappers';
import type { VercelJobData } from './vercel-webhook.controller';

/**
 * Consumes verified Vercel deliveries, maps them onto Deployment records and
 * re-emits `deployment.completed` so the ripple (monitor → notifications →
 * chat → webhooks) fires on real deployments.
 */
@Processor(VERCEL_EVENTS_QUEUE, { concurrency: 4 })
export class VercelProcessor extends WorkerHost {
  private readonly logger = new Logger('VercelWorker');

  constructor(
    private readonly config: VercelConfig,
    private readonly ingest: VercelIngestService,
  ) {
    super();
  }

  async process(job: Job<VercelJobData>): Promise<void> {
    if (!this.config.isEnabled()) return;

    const { event, deliveryId, payload } = job.data;
    const normalized = normalizeVercelWebhook(payload);
    if (!normalized) {
      this.logger.debug(`Ignoring unmapped Vercel event=${event} delivery=${deliveryId}`);
      return;
    }

    this.logger.log(
      `event=${event} deployment=${normalized.deploymentId} project=${normalized.projectId}`,
    );
    await this.ingest.ingestDeployment(normalized);
  }
}
