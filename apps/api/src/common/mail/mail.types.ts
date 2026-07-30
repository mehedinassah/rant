export interface MailMessage {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

/**
 * A pluggable email transport. Implementations must not throw for expected
 * delivery failures unless they want to signal a hard error — the MailService
 * treats email as best-effort and won't fail the caller's operation.
 */
export interface MailProvider {
  readonly name: string;
  send(to: string, subject: string, body: string): Promise<void>;
}
