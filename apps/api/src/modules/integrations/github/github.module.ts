import { Module } from '@nestjs/common';
import { GithubConfig } from './github.config';
import { GithubAuthService } from './github-auth.service';

/**
 * GitHub integration. Grows across tickets G2–G10; for now it exposes config +
 * App/OAuth authentication. Webhook ingestion (G3), the event processor (G4),
 * sync (G5) and the connect flow (G6) will be added here.
 */
@Module({
  providers: [GithubConfig, GithubAuthService],
  exports: [GithubConfig, GithubAuthService],
})
export class GithubModule {}
