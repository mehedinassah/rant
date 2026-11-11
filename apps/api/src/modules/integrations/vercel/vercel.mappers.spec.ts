import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  absoluteUrl,
  deploymentStateFor,
  normalizeVercelWebhook,
  VercelWebhookPayload,
} from './vercel.mappers';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8')) as VercelWebhookPayload;

describe('vercel mappers', () => {
  it('maps deployment lifecycle event types', () => {
    expect(deploymentStateFor('deployment.created')).toBe('BUILDING');
    expect(deploymentStateFor('deployment.building')).toBe('BUILDING');
    expect(deploymentStateFor('deployment.ready')).toBe('READY');
    expect(deploymentStateFor('deployment.succeeded')).toBe('READY');
    expect(deploymentStateFor('deployment.error')).toBe('FAILED');
    expect(deploymentStateFor('deployment.canceled')).toBe('CANCELLED');
    expect(deploymentStateFor('deployment.promoted')).toBeNull();
  });

  it('normalizes a real deployment.ready fixture', () => {
    const result = normalizeVercelWebhook(fixture('deployment.ready.json'));
    expect(result).toEqual({
      eventType: 'deployment.ready',
      deploymentId: 'dpl_abc123',
      projectId: 'prj_vercel_demo',
      projectName: 'rant-demo',
      url: 'https://rant-demo-abc123.vercel.app',
      branch: 'main',
      commitSha: 'd34db33fcafebabe0000000000000000deadbeef',
      pullRequestExternalId: '42',
      target: 'production',
      state: 'READY',
    });
  });

  it('drops unknown events and incomplete payloads', () => {
    expect(normalizeVercelWebhook({ type: 'deployment.promoted' })).toBeNull();
    expect(normalizeVercelWebhook({ type: 'deployment.ready', payload: {} })).toBeNull();
    expect(
      normalizeVercelWebhook({
        type: 'deployment.error',
        payload: { deployment: { id: 'dpl_x' } },
      }),
    ).toBeNull();
  });

  it('falls back to the target branch and keeps absolute URLs intact', () => {
    const result = normalizeVercelWebhook({
      type: 'deployment.error',
      payload: {
        deployment: { id: 'dpl_x', url: 'https://example.com/x', target: 'production' },
        project: { id: 'prj_x' },
      },
    });
    expect(result?.state).toBe('FAILED');
    expect(result?.branch).toBe('production');
    expect(result?.url).toBe('https://example.com/x');
    expect(result?.commitSha).toBeNull();
  });

  it('normalizes hostnames to https URLs', () => {
    expect(absoluteUrl('app.vercel.app')).toBe('https://app.vercel.app');
    expect(absoluteUrl('http://app.vercel.app')).toBe('http://app.vercel.app');
    expect(absoluteUrl('   ')).toBeNull();
    expect(absoluteUrl(null)).toBeNull();
  });
});
