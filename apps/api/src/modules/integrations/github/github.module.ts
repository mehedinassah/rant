import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GithubConfig } from './github.config';
import { GithubAuthService } from './github-auth.service';
import { GithubWebhookService } from './github-webhook.service';
import { GithubWebhookController } from './github-webhook.controller';
import { GITHUB_EVENTS_QUEUE } from './github.constants';

/**
 * GitHub integration. Grows across tickets G2–G10. Today: config + App/OAuth
 * auth (G2) and webhook ingestion (G3 — verify, dedupe, enqueue). The processor
 * (G4), sync (G5) and connect flow (G6) attach to the same queue/module next.
 */
@Module({
  imports: [BullModule.registerQueue({ name: GITHUB_EVENTS_QUEUE })],
  controllers: [GithubWebhookController],
  providers: [GithubConfig, GithubAuthService, GithubWebhookService],
  exports: [GithubConfig, GithubAuthService],
})
export class GithubModule {}
