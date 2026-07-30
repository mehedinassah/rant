import { Logger } from '@nestjs/common';
import { MailProvider } from '../mail.types';

/** Sends real email via Resend's HTTP API (no SDK — just fetch). Activated when
 * RESEND_API_KEY is set (or MAIL_PROVIDER=resend). */
export class ResendMailProvider implements MailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger('Mail');

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text: body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend send failed: ${res.status} ${detail.slice(0, 200)}`);
    }
  }
}
