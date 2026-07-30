import { MailService } from './mail.service';

// Minimal ConfigService stub; returns overrides or the provided default.
const cfg = (values: Record<string, string> = {}) =>
  ({ get: (k: string, d?: string) => values[k] ?? d ?? '' }) as never;

describe('MailService', () => {
  it('defaults to the console provider when nothing is configured', () => {
    expect(new MailService(cfg()).providerName).toBe('console');
  });

  it('selects Resend when an API key is present', () => {
    expect(new MailService(cfg({ RESEND_API_KEY: 're_test' })).providerName).toBe('resend');
  });

  it('honors an explicit MAIL_PROVIDER=console even with a key', () => {
    expect(new MailService(cfg({ MAIL_PROVIDER: 'console', RESEND_API_KEY: 're_test' })).providerName).toBe('console');
  });

  it('captures sent messages in a most-recent-first outbox', async () => {
    const mail = new MailService(cfg());
    await mail.send('a@example.com', 'First', 'body one');
    await mail.send('b@example.com', 'Second', 'body two');
    const outbox = mail.getOutbox();
    expect(outbox).toHaveLength(2);
    expect(outbox[0].to).toBe('b@example.com');
    expect(outbox[1].to).toBe('a@example.com');
  });

  it('returns the persisted message with a timestamp', async () => {
    const msg = await new MailService(cfg()).send('c@example.com', 'Hi', 'hello');
    expect(msg.to).toBe('c@example.com');
    expect(msg.sentAt).toBeInstanceOf(Date);
  });

  it('caps the outbox so it cannot grow unbounded', async () => {
    const mail = new MailService(cfg());
    for (let i = 0; i < 60; i++) await mail.send(`u${i}@example.com`, 'n', 'b');
    expect(mail.getOutbox().length).toBeLessThanOrEqual(50);
  });

  it('never throws when the provider fails (best-effort delivery)', async () => {
    const mail = new MailService(cfg());
    // Force the provider to reject; send() should swallow and still return.
    (mail as unknown as { provider: { send: () => Promise<void> } }).provider.send = () =>
      Promise.reject(new Error('boom'));
    await expect(mail.send('x@example.com', 's', 'b')).resolves.toMatchObject({ to: 'x@example.com' });
  });
});
