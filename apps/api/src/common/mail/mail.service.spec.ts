import { MailService } from './mail.service';

describe('MailService (dev stub)', () => {
  it('captures sent messages in a most-recent-first outbox', async () => {
    const mail = new MailService();
    await mail.send('a@example.com', 'First', 'body one');
    await mail.send('b@example.com', 'Second', 'body two');

    const outbox = mail.getOutbox();
    expect(outbox).toHaveLength(2);
    expect(outbox[0].to).toBe('b@example.com');
    expect(outbox[0].subject).toBe('Second');
    expect(outbox[1].to).toBe('a@example.com');
  });

  it('returns the persisted message with a timestamp', async () => {
    const mail = new MailService();
    const msg = await mail.send('c@example.com', 'Hi', 'hello');
    expect(msg.to).toBe('c@example.com');
    expect(msg.sentAt).toBeInstanceOf(Date);
  });

  it('caps the outbox so it cannot grow unbounded', async () => {
    const mail = new MailService();
    for (let i = 0; i < 60; i++) await mail.send(`u${i}@example.com`, 'n', 'b');
    expect(mail.getOutbox().length).toBeLessThanOrEqual(50);
  });
});
