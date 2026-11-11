import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SentryProcessor } from './sentry.processor';
import { SentryWebhookPayload } from './sentry.mappers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8')) as SentryWebhookPayload;

describe('SentryProcessor', () => {
  it('maps a recorded issue.created fixture into an ingest call', async () => {
    const ingest = { ingestIssue: jest.fn().mockResolvedValue(undefined) };
    const proc = new SentryProcessor({ isEnabled: () => true } as never, ingest as never);

    await proc.process({
      data: {
        event: 'issue:created',
        resource: 'issue',
        deliveryId: 'sentry-delivery-1',
        payload: fixture('issue.created.json'),
      },
    } as never);

    expect(ingest.ingestIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'open',
        issueId: '5566778899',
        projectId: '4500000000000001',
        severity: 'MAJOR',
        title: 'TypeError: Cannot read properties of undefined',
      }),
    );
  });

  it('ignores non-issue resources and disabled integrations', async () => {
    const ingest = { ingestIssue: jest.fn() };

    const enabled = new SentryProcessor({ isEnabled: () => true } as never, ingest as never);
    await enabled.process({
      data: {
        event: 'event_alert:created',
        resource: 'event_alert',
        deliveryId: 'd1',
        payload: fixture('issue.created.json'),
      },
    } as never);
    expect(ingest.ingestIssue).not.toHaveBeenCalled();

    const disabled = new SentryProcessor({ isEnabled: () => false } as never, ingest as never);
    await disabled.process({
      data: {
        event: 'issue:created',
        resource: 'issue',
        deliveryId: 'd2',
        payload: fixture('issue.created.json'),
      },
    } as never);
    expect(ingest.ingestIssue).not.toHaveBeenCalled();
  });
});
