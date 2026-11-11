import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  incidentActionFor,
  normalizeSentryWebhook,
  SentryWebhookPayload,
  severityForLevel,
} from './sentry.mappers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8')) as SentryWebhookPayload;

describe('sentry mappers', () => {
  it('maps issue actions onto incident lifecycle', () => {
    expect(incidentActionFor('created')).toBe('open');
    expect(incidentActionFor('unresolved')).toBe('open');
    expect(incidentActionFor('resolved')).toBe('resolve');
    expect(incidentActionFor('assigned')).toBeNull();
    expect(incidentActionFor('ignored')).toBeNull();
  });

  it('maps Sentry levels to incident severity', () => {
    expect(severityForLevel('fatal')).toBe('CRITICAL');
    expect(severityForLevel('error')).toBe('MAJOR');
    expect(severityForLevel('warning')).toBe('MINOR');
    expect(severityForLevel('info')).toBe('MINOR');
  });

  it('normalizes a real issue.created fixture', () => {
    const result = normalizeSentryWebhook('issue', fixture('issue.created.json'));
    expect(result).toEqual({
      action: 'open',
      issueId: '5566778899',
      projectId: '4500000000000001',
      projectName: 'checkout-web',
      title: 'TypeError: Cannot read properties of undefined',
      culprit: 'src/checkout/handler.ts in processOrder',
      permalink: 'https://acme.sentry.io/issues/5566778899/',
      level: 'error',
      severity: 'MAJOR',
      firstSeen: new Date('2026-07-28T09:58:00Z'),
    });
  });

  it('ignores non-issue resources and actions', () => {
    expect(normalizeSentryWebhook('event_alert', fixture('issue.created.json'))).toBeNull();
    expect(
      normalizeSentryWebhook('issue', { action: 'assigned', data: { issue: { id: '1', project: { id: '2' } } } }),
    ).toBeNull();
    expect(normalizeSentryWebhook('issue', { action: 'created', data: {} })).toBeNull();
  });

  it('falls back to the project slug when the numeric id is absent', () => {
    const result = normalizeSentryWebhook('issue', {
      action: 'resolved',
      data: { issue: { id: 7, title: 'boom', level: 'fatal', project: { slug: 'api' } } },
    });
    expect(result?.projectId).toBe('api');
    expect(result?.action).toBe('resolve');
    expect(result?.severity).toBe('CRITICAL');
    expect(result?.firstSeen).toBeNull();
  });
});
