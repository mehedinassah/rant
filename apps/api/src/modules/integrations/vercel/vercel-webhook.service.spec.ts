import { createHmac } from 'node:crypto';
import { IntegrationProvider, Prisma } from '@rant/database';
import { VercelWebhookService } from './vercel-webhook.service';

describe('VercelWebhookService', () => {
  const config = { webhookSecret: 's3cret' } as never;
  const body = Buffer.from('{"type":"deployment.ready"}');

  const makeService = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { integrationWebhookDelivery: { create } } as never;
    return { service: new VercelWebhookService(config, prisma), create };
  };

  it('accepts an HMAC-SHA1 signature (Vercel default)', () => {
    const { service } = makeService();
    const signature = createHmac('sha1', 's3cret').update(body).digest('hex');
    expect(service.verifySignature(body, signature)).toBe(true);
  });

  it('accepts an HMAC-SHA256 signature', () => {
    const { service } = makeService();
    const signature = createHmac('sha256', 's3cret').update(body).digest('hex');
    expect(service.verifySignature(body, signature)).toBe(true);
  });

  it('rejects a tampered body, a missing header, and a wrong secret', () => {
    const { service } = makeService();
    const signature = createHmac('sha1', 's3cret').update(body).digest('hex');
    expect(service.verifySignature(Buffer.from('{"type":"deployment.error"}'), signature)).toBe(false);
    expect(service.verifySignature(body, undefined)).toBe(false);
    const wrong = createHmac('sha1', 'nope').update(body).digest('hex');
    expect(service.verifySignature(body, wrong)).toBe(false);
  });

  it('claims a delivery exactly once and records its project', async () => {
    const { service, create } = makeService();
    await expect(
      service.claimDelivery('delivery-1', 'deployment.ready', 'prj_vercel_demo'),
    ).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        provider: IntegrationProvider.VERCEL,
        deliveryId: 'delivery-1',
        event: 'deployment.ready',
        externalProjectId: 'prj_vercel_demo',
      },
    });
  });

  it('ignores a duplicate delivery id (P2002)', async () => {
    const { service, create } = makeService();
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.claimDelivery('delivery-1', 'deployment.ready')).resolves.toBe(false);
  });

  it('does not claim an empty delivery id', async () => {
    const { service, create } = makeService();
    await expect(service.claimDelivery('', 'deployment.ready')).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
