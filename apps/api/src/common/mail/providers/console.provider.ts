import { Logger } from '@nestjs/common';
import { MailProvider } from '../mail.types';

/** Default transport: logs the message. Paired with MailService's outbox, this
 * makes the invite/notification flows fully observable without a real provider. */
export class ConsoleMailProvider implements MailProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Mail');

  async send(to: string, subject: string): Promise<void> {
    this.logger.log(`✉️  To: ${to} — ${subject}`);
  }
}
