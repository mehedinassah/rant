import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

/**
 * Development mail stub. In production this would delegate to a provider
 * (Resend / SES / Postmark); here we log the message and keep a small in-memory
 * outbox so the flow is observable and testable without external credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly outbox: MailMessage[] = [];
  private static readonly MAX_OUTBOX = 50;

  async send(to: string, subject: string, body: string): Promise<MailMessage> {
    const message: MailMessage = { to, subject, body, sentAt: new Date() };
    this.outbox.unshift(message);
    if (this.outbox.length > MailService.MAX_OUTBOX) this.outbox.length = MailService.MAX_OUTBOX;
    this.logger.log(`✉️  To: ${to} — ${subject}`);
    return message;
  }

  /** Most-recent-first snapshot of simulated sends (dev/testing aid). */
  getOutbox(): MailMessage[] {
    return [...this.outbox];
  }
}
