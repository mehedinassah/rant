import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import {
  bearer,
  createTestApp,
  resetDatabase,
  sentrySignature,
  TestContext,
  vercelSignature,
  waitFor,
} from './utils';

const fixture = (...parts: string[]) =>
  readFileSync(join(__dirname, '..', 'src', ...parts), 'utf8');

const processOnce = (socket: Socket, event: string, timeoutMs = 15_000): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for socket event ${event}`)), timeoutMs);
    socket.once(event, (payload: Record<string, unknown>) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/**
 * The real-integration ripple, end to end: a signed Vercel deployment webhook
 * becomes a live Deployment (and retargets monitoring); a signed Sentry issue
 * becomes an Incident + bug issue + notification + chat message, and the same
 * event reaches an authenticated Socket.IO client.
 */
describe('Vercel + Sentry integrations (e2e)', () => {
  let ctx: TestContext;
  let token = '';
  let ownerId = '';
  let orgId = '';
  let repoId = '';
  let environmentId = '';
  let socket: Socket | undefined;

  const suffix = `${Date.now()}`;
  const vercelFixture = fixture(
    'modules',
    'integrations',
    'vercel',
    '__fixtures__',
    'deployment.ready.json',
  );
  const sentryFixture = fixture(
    'modules',
    'integrations',
    'sentry',
    '__fixtures__',
    'issue.created.json',
  );

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);

    const reg = await request(ctx.http)
      .post('/api/v1/auth/register')
      .send({ name: 'Integrations Owner', email: `integrations-${suffix}@example.com`, password: 'correct-horse-battery' })
      .expect(201);
    token = reg.body.accessToken;
    ownerId = reg.body.user.id;

    const org = await request(ctx.http)
      .post('/api/v1/organizations')
      .set(bearer(token))
      .send({ name: 'Ripple Co', slug: `ripple-${suffix}` })
      .expect(201);
    orgId = org.body.id;

    const ws = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/workspaces`)
      .set(bearer(token))
      .send({ name: 'Engineering', slug: 'engineering' })
      .expect(201);

    const project = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/workspaces/${ws.body.id}/projects`)
      .set(bearer(token))
      .send({ name: 'Ripple App', key: 'RIP' })
      .expect(201);

    const repo = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/repositories`)
      .set(bearer(token))
      .send({ name: 'rant-demo', slug: 'rant-demo', projectId: project.body.id })
      .expect(201);
    repoId = repo.body.id;

    const env = await ctx.prisma.environment.findFirstOrThrow({
      where: { repositoryId: repoId, type: 'PRODUCTION' },
    });
    environmentId = env.id;

    await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/integrations/vercel/links`)
      .set(bearer(token))
      .send({ repositoryId: repoId, externalProjectId: 'prj_vercel_demo', externalProjectName: 'rant-demo' })
      .expect(201);

    await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/integrations/sentry/links`)
      .set(bearer(token))
      .send({ repositoryId: repoId, externalProjectId: '4500000000000001', externalProjectName: 'checkout-web' })
      .expect(201);
  });

  afterAll(async () => {
    socket?.disconnect();
    await ctx?.app.close();
  });

  it('reports both integrations as enabled and linked', async () => {
    const vercel = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/integrations/vercel/status`)
      .set(bearer(token))
      .expect(200);
    expect(vercel.body).toMatchObject({ provider: 'vercel', enabled: true, linkedProjects: 1 });

    const sentry = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/integrations/sentry/status`)
      .set(bearer(token))
      .expect(200);
    expect(sentry.body).toMatchObject({ provider: 'sentry', enabled: true, linkedProjects: 1 });
  });

  it('rejects an unsigned Vercel webhook', async () => {
    await request(ctx.http)
      .post('/api/v1/integrations/vercel/webhook')
      .set('content-type', 'application/json')
      .send(vercelFixture)
      .expect(401);
  });

  it('turns a signed Vercel deployment.ready into a live deployment + monitor target', async () => {
    const res = await request(ctx.http)
      .post('/api/v1/integrations/vercel/webhook')
      .set('content-type', 'application/json')
      .set('x-vercel-signature', vercelSignature(vercelFixture))
      .set('x-vercel-id', `e2e-vercel-${suffix}`)
      .send(vercelFixture)
      .expect(201);
    expect(res.body).toMatchObject({ ok: true, queued: true });

    const deployment = await waitFor(
      () => ctx.prisma.deployment.findFirst({ where: { externalId: 'dpl_abc123' } }),
      (d) => d?.status === 'READY',
      'Vercel deployment READY',
    );

    expect(deployment).toMatchObject({
      environmentId,
      branch: 'main',
      commitSha: 'd34db33fcafebabe0000000000000000deadbeef',
      source: 'VERCEL',
      url: 'https://rant-demo-abc123.vercel.app',
    });

    // The existing deployment listener retargeted the environment's monitor.
    const env = await ctx.prisma.environment.findUniqueOrThrow({ where: { id: environmentId } });
    expect(env.currentDeploymentId).toBe(deployment!.id);

    const monitor = await waitFor(
      () => ctx.prisma.monitor.findUnique({ where: { environmentId } }),
      (m) => m?.target === 'https://rant-demo-abc123.vercel.app',
      'monitor retargeted to the Vercel URL',
    );
    expect(monitor!.target).toBe('https://rant-demo-abc123.vercel.app');
  });

  it('is idempotent for duplicate deliveries and replayed deployments', async () => {
    // Same delivery id → deduped at the boundary.
    const dup = await request(ctx.http)
      .post('/api/v1/integrations/vercel/webhook')
      .set('content-type', 'application/json')
      .set('x-vercel-signature', vercelSignature(vercelFixture))
      .set('x-vercel-id', `e2e-vercel-${suffix}`)
      .send(vercelFixture)
      .expect(201);
    expect(dup.body).toMatchObject({ ok: true, queued: false });

    // New delivery id, same deployment → processor upsert is a no-op.
    await request(ctx.http)
      .post('/api/v1/integrations/vercel/webhook')
      .set('content-type', 'application/json')
      .set('x-vercel-signature', vercelSignature(vercelFixture))
      .set('x-vercel-id', `e2e-vercel-replay-${suffix}`)
      .send(vercelFixture)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 1500));
    const count = await ctx.prisma.deployment.count({ where: { externalId: 'dpl_abc123' } });
    expect(count).toBe(1);
  });

  it('scopes the delivery log to the org’s linked projects', async () => {
    const res = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/integrations/vercel/deliveries`)
      .set(bearer(token))
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      provider: 'VERCEL',
      event: 'deployment.ready',
      externalProjectId: 'prj_vercel_demo',
    });
  });

  it('refuses to re-point another organization’s linked provider project', async () => {
    const otherOrg = await request(ctx.http)
      .post('/api/v1/organizations')
      .set(bearer(token))
      .send({ name: 'Other Co', slug: `other-${suffix}` })
      .expect(201);
    const otherWs = await request(ctx.http)
      .post(`/api/v1/organizations/${otherOrg.body.id}/workspaces`)
      .set(bearer(token))
      .send({ name: 'Eng', slug: 'eng' })
      .expect(201);
    const otherProject = await request(ctx.http)
      .post(`/api/v1/organizations/${otherOrg.body.id}/workspaces/${otherWs.body.id}/projects`)
      .set(bearer(token))
      .send({ name: 'Other App', key: 'OTH' })
      .expect(201);
    const otherRepo = await request(ctx.http)
      .post(`/api/v1/organizations/${otherOrg.body.id}/repositories`)
      .set(bearer(token))
      .send({ name: 'other-app', slug: 'other-app', projectId: otherProject.body.id })
      .expect(201);

    await request(ctx.http)
      .post(`/api/v1/organizations/${otherOrg.body.id}/integrations/vercel/links`)
      .set(bearer(token))
      .send({ repositoryId: otherRepo.body.id, externalProjectId: 'prj_vercel_demo' })
      .expect(409);
  });

  it('turns a signed Sentry issue into an incident, bug issue, notification and chat post', async () => {
    const res = await request(ctx.http)
      .post('/api/v1/integrations/sentry/webhook')
      .set('content-type', 'application/json')
      .set('sentry-hook-resource', 'issue')
      .set('sentry-hook-signature', sentrySignature(sentryFixture))
      .set('request-id', `e2e-sentry-${suffix}`)
      .send(sentryFixture)
      .expect(201);
    expect(res.body).toMatchObject({ ok: true, queued: true });

    const incident = await waitFor(
      () =>
        ctx.prisma.incident.findFirst({
          where: { externalId: '5566778899' },
          include: { issue: true },
        }),
      (i) => i?.status === 'OPEN',
      'Sentry incident OPEN',
    );

    expect(incident).toMatchObject({
      source: 'SENTRY',
      severity: 'MAJOR',
      title: 'TypeError: Cannot read properties of undefined',
    });
    expect(incident!.issue).toBeTruthy();

    // The incident's bug issue exists on the linked project.
    const bug = await ctx.prisma.issue.findUniqueOrThrow({ where: { id: incident!.issueId! } });
    expect(bug.type).toBe('BUG');
    expect(bug.title).toBe('TypeError: Cannot read properties of undefined');

    // Notifications fan out to the owner; chat posts to #activity.
    const notification = await waitFor(
      () =>
        ctx.prisma.notification.findFirst({
          where: { userId: ownerId, type: 'INCIDENT_OPENED' },
        }),
      (n) => Boolean(n),
      'incident notification',
    );
    expect(notification!.title).toContain('MAJOR');

    const chat = await waitFor(
      () =>
        ctx.prisma.chatMessage.findFirst({
          where: { body: { contains: 'incident' } },
        }),
      (m) => Boolean(m),
      '#activity incident message',
    );
    expect(chat!.kind).toBe('SYSTEM');
  });

  it('resolves the Sentry incident and closes its bug issue', async () => {
    const resolvedBody = sentryFixture.replace('"action": "created"', '"action": "resolved"');
    await request(ctx.http)
      .post('/api/v1/integrations/sentry/webhook')
      .set('content-type', 'application/json')
      .set('sentry-hook-resource', 'issue')
      .set('sentry-hook-signature', sentrySignature(resolvedBody))
      .set('request-id', `e2e-sentry-resolved-${suffix}`)
      .send(resolvedBody)
      .expect(201);

    const incident = await waitFor(
      () => ctx.prisma.incident.findFirst({ where: { externalId: '5566778899' } }),
      (i) => i?.status === 'RESOLVED',
      'Sentry incident RESOLVED',
    );
    const bug = await ctx.prisma.issue.findUniqueOrThrow({ where: { id: incident!.issueId! } });
    expect(bug.status).toBe('DONE');
  });

  it('pushes incident.opened to an authenticated Socket.IO subscriber (and drafts a postmortem)', async () => {
    // Stop the simulated prober so the next incident on the bus is ours.
    await ctx.prisma.monitor.update({ where: { environmentId }, data: { isActive: false } });

    socket = io(`${ctx.origin}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket connect timeout')), 10_000);
      socket!.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket!.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const ack = await new Promise<{ ok: boolean }>((resolve, reject) => {
      socket!.timeout(5_000).emit('subscribe:org', { orgId }, (err: Error | null, res: { ok: boolean }) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    expect(ack.ok).toBe(true);

    // A CRITICAL (fatal) Sentry issue — also exercises the postmortem ripple.
    const criticalId = '99001122';
    const criticalBody = JSON.stringify({
      action: 'created',
      resource: 'issue',
      data: {
        issue: {
          id: criticalId,
          title: 'Database connection pool exhausted',
          culprit: 'src/db/pool.ts',
          level: 'fatal',
          permalink: `https://acme.sentry.io/issues/${criticalId}/`,
          firstSeen: new Date().toISOString(),
          project: { id: '4500000000000001', slug: 'checkout-web', name: 'checkout-web' },
        },
      },
    });

    const eventPromise = processOnce(socket, 'incident.opened');
    await request(ctx.http)
      .post('/api/v1/integrations/sentry/webhook')
      .set('content-type', 'application/json')
      .set('sentry-hook-resource', 'issue')
      .set('sentry-hook-signature', sentrySignature(criticalBody))
      .set('request-id', `e2e-sentry-critical-${suffix}`)
      .send(criticalBody)
      .expect(201);

    const event = await eventPromise;
    expect(event).toMatchObject({
      orgId,
      repoId,
      severity: 'CRITICAL',
      title: 'Database connection pool exhausted',
    });

    const postmortem = await waitFor(
      () =>
        ctx.prisma.doc.findFirst({
          where: { title: { startsWith: 'Postmortem: Database connection pool exhausted' } },
        }),
      (d) => Boolean(d),
      'auto-drafted postmortem doc',
    );
    expect(postmortem!.workspaceId).toBeTruthy();
  });
});
