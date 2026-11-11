import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VercelProcessor } from './vercel.processor';
import { VercelWebhookPayload } from './vercel.mappers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8')) as VercelWebhookPayload;

describe('VercelProcessor', () => {
  it('maps a recorded deployment.ready fixture into an ingest call', async () => {
    const ingest = { ingestDeployment: jest.fn().mockResolvedValue(undefined) };
    const config = { isEnabled: () => true };
    const proc = new VercelProcessor(config as never, ingest as never);

    await proc.process({
      data: {
        event: 'deployment.ready',
        deliveryId: 'dpl-delivery-1',
        payload: fixture('deployment.ready.json'),
      },
    } as never);

    expect(ingest.ingestDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: 'dpl_abc123',
        projectId: 'prj_vercel_demo',
        state: 'READY',
        url: 'https://rant-demo-abc123.vercel.app',
        branch: 'main',
        commitSha: 'd34db33fcafebabe0000000000000000deadbeef',
      }),
    );
  });

  it('ignores unmapped events and disabled integrations', async () => {
    const ingest = { ingestDeployment: jest.fn() };

    const enabled = new VercelProcessor({ isEnabled: () => true } as never, ingest as never);
    await enabled.process({
      data: { event: 'deployment.promoted', deliveryId: 'd1', payload: { type: 'deployment.promoted' } },
    } as never);
    expect(ingest.ingestDeployment).not.toHaveBeenCalled();

    const disabled = new VercelProcessor({ isEnabled: () => false } as never, ingest as never);
    await disabled.process({
      data: {
        event: 'deployment.ready',
        deliveryId: 'd2',
        payload: fixture('deployment.ready.json'),
      },
    } as never);
    expect(ingest.ingestDeployment).not.toHaveBeenCalled();
  });
});
