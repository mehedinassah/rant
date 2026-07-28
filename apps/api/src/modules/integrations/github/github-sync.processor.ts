import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GITHUB_SYNC_QUEUE } from './github.constants';
import { GithubSyncService } from './github-sync.service';

export interface GithubSyncJobData {
  installationId: string;
}

/** Runs backfill off the request path so a large org doesn't block connect. */
@Processor(GITHUB_SYNC_QUEUE, { concurrency: 2 })
export class GithubSyncProcessor extends WorkerHost {
  private readonly logger = new Logger('GithubSyncWorker');

  constructor(private readonly sync: GithubSyncService) {
    super();
  }

  async process(job: Job<GithubSyncJobData>): Promise<void> {
    await this.sync.syncInstallation(job.data.installationId);
  }
}
