import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GithubConfig } from './github.config';
import { GithubAuthService } from './github-auth.service';
import { GithubWebhookService } from './github-webhook.service';
import { GithubWebhookController } from './github-webhook.controller';
import { GithubUserMapper } from './github-user.mapper';
import { GithubIngestService } from './github-ingest.service';
import { GithubProcessor } from './github.processor';
import { GithubApiClient } from './github-api.client';
import { GithubSyncService } from './github-sync.service';
import { GithubSyncProcessor } from './github-sync.processor';
import { GithubConnectService } from './github-connect.service';
import { GithubConnectController } from './github-connect.controller';
import { GITHUB_EVENTS_QUEUE, GITHUB_SYNC_QUEUE } from './github.constants';

/**
 * GitHub integration. Grows across tickets G2–G10. Today: config + App/OAuth
 * auth (G2), webhook ingestion (G3), the event processor + mappers (G4) that
 * re-emit domain events so the ripple fires, and backfill sync (G5). The
 * connect flow (G6) attaches here next.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: GITHUB_EVENTS_QUEUE }, { name: GITHUB_SYNC_QUEUE }),
  ],
  controllers: [GithubWebhookController, GithubConnectController],
  providers: [
    GithubConfig,
    GithubAuthService,
    GithubWebhookService,
    GithubUserMapper,
    GithubIngestService,
    GithubProcessor,
    GithubApiClient,
    GithubSyncService,
    GithubSyncProcessor,
    GithubConnectService,
  ],
  exports: [GithubConfig, GithubAuthService, GithubIngestService, GithubUserMapper, GithubSyncService],
})
export class GithubModule {}
