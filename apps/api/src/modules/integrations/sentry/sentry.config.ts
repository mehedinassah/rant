import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sentry integration config. Sentry's webhook "Client Secret" signs every
 * delivery; the integration is enabled by default only when that secret exists.
 */
@Injectable()
export class SentryConfig {
  constructor(private readonly config: ConfigService) {}

  get webhookSecret(): string {
    return (
      this.config.get<string>('SENTRY_WEBHOOK_SECRET', '') ||
      this.config.get<string>('SENTRY_CLIENT_SECRET', '')
    );
  }

  isConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  isEnabled(): boolean {
    const flag = this.config.get<string>('FEATURE_SENTRY', '');
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return this.isConfigured();
  }
}
