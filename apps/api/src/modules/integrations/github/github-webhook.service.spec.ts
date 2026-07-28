import { createHmac } from 'node:crypto';
import { Prisma } from '@rant/database';
import { GithubWebhookService } from './github-webhook.service';
import { GithubConfig } from './github.config';

const SECRET = 'test-webhook-secret';
const config = { webhookSecret: SECRET } as unknown as GithubConfig;

function sign(body: Buffer, secret = SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('GithubWebhookService.verifySignature', () => {
  const svc = new GithubWebhookService(config, {} as never);
  const body = Buffer.from(JSON.stringify({ action: 'opened' }));

  it('accepts a correctly signed payload', () => {
    expect(svc.verifySignature(body, sign(body))).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(svc.verifySignature(Buffer.from('tampered'), sign(body))).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(svc.verifySignature(body, sign(body, 'other-secret'))).toBe(false);
  });

  it('rejects missing / malformed headers', () => {
    expect(svc.verifySignature(body, undefined)).toBe(false);
    expect(svc.verifySignature(body, 'garbage')).toBe(false);
    expect(svc.verifySignature(body, 'sha1=abc')).toBe(false);
  });
});

describe('GithubWebhookService.claimDelivery', () => {
  it('returns true the first time a delivery id is seen', async () => {
    const create = jest.fn().mockResolvedValue({});
    const svc = new GithubWebhookService(config, { githubWebhookDelivery: { create } } as never);
    await expect(svc.claimDelivery('d1', 'push')).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { deliveryId: 'd1', event: 'push' } });
  });

  it('returns false on a duplicate (unique violation)', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const create = jest.fn().mockRejectedValue(dup);
    const svc = new GithubWebhookService(config, { githubWebhookDelivery: { create } } as never);
    await expect(svc.claimDelivery('d1', 'push')).resolves.toBe(false);
  });

  it('returns false for an empty delivery id', async () => {
    const svc = new GithubWebhookService(config, {} as never);
    await expect(svc.claimDelivery('', 'push')).resolves.toBe(false);
  });
});
