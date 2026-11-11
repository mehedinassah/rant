import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vercel integration config. Enabled by default only when a webhook secret is
 * present, so a stock checkout has zero behavior change.
 */
@Injectable()
export class VercelConfig {
  constructor(private readonly config: ConfigService) {}

  get webhookSecret(): string {
    return this.config.get<string>('VERCEL_WEBHOOK_SECRET', '');
  }

  /** Optional team id, surfaced in the status endpoint for operator clarity. */
  get teamId(): string {
    return this.config.get<string>('VERCEL_TEAM_ID', '');
  }

  /** Optional REST token; only needed for future backfill (webhooks work without). */
  get accessToken(): string {
    return this.config.get<string>('VERCEL_TOKEN', '');
  }

  isConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  isEnabled(): boolean {
    const flag = this.config.get<string>('FEATURE_VERCEL', '');
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return this.isConfigured();
  }
}
