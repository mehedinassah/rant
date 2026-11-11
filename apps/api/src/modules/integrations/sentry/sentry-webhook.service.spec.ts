import { createHmac } from 'node:crypto';
import { IntegrationProvider, Prisma } from '@rant/database';
import { SentryWebhookService } from './sentry-webhook.service';

describe('SentryWebhookService', () => {
  const config = { webhookSecret: 'client-secret' } as never;
  const body = Buffer.from('{"action":"created"}');

  const makeService = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { integrationWebhookDelivery: { create } } as never;
    return { service: new SentryWebhookService(config, prisma), create };
  };

  it('accepts a hex HMAC-SHA256 signature', () => {
    const { service } = makeService();
    const signature = createHmac('sha256', 'client-secret').update(body).digest('hex');
    expect(service.verifySignature(body, signature)).toBe(true);
  });

  it('accepts a prefixed signature and normalizes case', () => {
    const { service } = makeService();
    const signature = createHmac('sha256', 'client-secret').update(body).digest('hex');
    expect(service.verifySignature(body, `sha256=${signature.toUpperCase()}`)).toBe(true);
  });

  it('rejects a tampered body and missing header', () => {
    const { service } = makeService();
    const signature = createHmac('sha256', 'client-secret').update(body).digest('hex');
    expect(service.verifySignature(Buffer.from('{"action":"resolved"}'), signature)).toBe(false);
    expect(service.verifySignature(body, undefined)).toBe(false);
  });

  it('claims a delivery once and ignores a P2002 duplicate', async () => {
    const { service, create } = makeService();
    await expect(
      service.claimDelivery('req-1', 'issue:created', '4500000000000001'),
    ).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        provider: IntegrationProvider.SENTRY,
        deliveryId: 'req-1',
        event: 'issue:created',
        externalProjectId: '4500000000000001',
      },
    });

    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.claimDelivery('req-1', 'issue:created')).resolves.toBe(false);
  });
});
