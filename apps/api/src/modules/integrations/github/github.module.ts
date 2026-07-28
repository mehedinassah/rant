import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GithubConfig } from './github.config';
import { GithubAuthService } from './github-auth.service';
import { GithubWebhookService } from './github-webhook.service';
import { GithubWebhookController } from './github-webhook.controller';
import { GithubUserMapper } from './github-user.mapper';
import { GithubIngestService } from './github-ingest.service';
import { GithubProcessor } from './github.processor';
import { GITHUB_EVENTS_QUEUE } from './github.constants';

/**
 * GitHub integration. Grows across tickets G2–G10. Today: config + App/OAuth
 * auth (G2), webhook ingestion (G3), and the event processor + mappers (G4)
 * that map real GitHub events onto rant models and re-emit the domain events so
 * the ripple fires. Sync (G5) and the connect flow (G6) attach here next.
 */
@Module({
  imports: [BullModule.registerQueue({ name: GITHUB_EVENTS_QUEUE })],
  controllers: [GithubWebhookController],
  providers: [
    GithubConfig,
    GithubAuthService,
    GithubWebhookService,
    GithubUserMapper,
    GithubIngestService,
    GithubProcessor,
  ],
  exports: [GithubConfig, GithubAuthService, GithubIngestService, GithubUserMapper],
})
export class GithubModule {}
