import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailMessage, MailProvider } from './mail.types';
import { ConsoleMailProvider } from './providers/console.provider';
import { ResendMailProvider } from './providers/resend.provider';

export type { MailMessage } from './mail.types';

/**
 * Email facade. Selects a transport from config (console by default, Resend when
 * configured) and keeps a small in-memory outbox for dev observability + tests.
 * Delivery is best-effort: a provider failure is logged, never thrown, so it
 * can't fail the caller's operation (e.g. sending an invite).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly outbox: MailMessage[] = [];
  private static readonly MAX_OUTBOX = 50;
  private readonly provider: MailProvider;

  constructor(config: ConfigService) {
    this.provider = MailService.selectProvider(config);
    this.logger.log(`mail provider: ${this.provider.name}`);
  }

  private static selectProvider(config: ConfigService): MailProvider {
    const explicit = config.get<string>('MAIL_PROVIDER', '');
    const apiKey = config.get<string>('RESEND_API_KEY', '');
    const from = config.get<string>('MAIL_FROM', 'rant <onboarding@resend.dev>');
    const useResend = explicit === 'resend' || (explicit === '' && Boolean(apiKey));
    if (useResend && apiKey) return new ResendMailProvider(apiKey, from);
    return new ConsoleMailProvider();
  }

  async send(to: string, subject: string, body: string): Promise<MailMessage> {
    const message: MailMessage = { to, subject, body, sentAt: new Date() };
    this.outbox.unshift(message);
    if (this.outbox.length > MailService.MAX_OUTBOX) this.outbox.length = MailService.MAX_OUTBOX;
    try {
      await this.provider.send(to, subject, body);
    } catch (err) {
      this.logger.error(`mail send failed (${this.provider.name}): ${(err as Error).message}`);
    }
    return message;
  }

  /** Most-recent-first snapshot of sends (dev/testing aid). */
  getOutbox(): MailMessage[] {
    return [...this.outbox];
  }

  /** Which transport is active (surfaced for diagnostics). */
  get providerName(): string {
    return this.provider.name;
  }
}
