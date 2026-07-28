import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Reads and normalizes GitHub App configuration from the environment. Kept
 * separate from the services so both auth and webhook verification share one
 * source of truth, and so `isConfigured()` / `isEnabled()` gate cleanly when
 * credentials are absent (dev, CI, or the feature simply turned off).
 */
@Injectable()
export class GithubConfig {
  private readonly logger = new Logger('GithubConfig');

  constructor(private readonly config: ConfigService) {}

  get appId(): string {
    return this.config.get<string>('GITHUB_APP_ID', '');
  }

  get clientId(): string {
    return this.config.get<string>('GITHUB_APP_CLIENT_ID', '');
  }

  get clientSecret(): string {
    return this.config.get<string>('GITHUB_APP_CLIENT_SECRET', '');
  }

  get webhookSecret(): string {
    return this.config.get<string>('GITHUB_WEBHOOK_SECRET', '');
  }

  get appSlug(): string {
    return this.config.get<string>('GITHUB_APP_SLUG', '');
  }

  /**
   * The App private key as a PEM string. Accepts either a raw PEM (with BEGIN
   * header) or a base64-encoded PEM (preferred for single-line env vars).
   */
  get privateKey(): string {
    const raw = this.config.get<string>('GITHUB_APP_PRIVATE_KEY', '');
    if (!raw) return '';
    if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n');
    try {
      return Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }

  /** True when the App credentials needed for auth are all present. */
  isConfigured(): boolean {
    return Boolean(this.appId && this.privateKey && this.webhookSecret);
  }

  /** Master feature flag; defaults on when configured, off otherwise. */
  isEnabled(): boolean {
    const flag = this.config.get<string>('FEATURE_GITHUB', '');
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return this.isConfigured();
  }
}
