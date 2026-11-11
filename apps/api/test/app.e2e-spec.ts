import request from 'supertest';
import { bearer, createTestApp, resetDatabase, TestContext } from './utils';

/**
 * Core end-to-end flow through the real HTTP stack: auth → org → workspace →
 * project → issue → comment → audit, plus RBAC isolation and health/billing.
 */
describe('rant API (e2e)', () => {
  let ctx: TestContext;
  const suffix = `${Date.now()}`;
  const ownerEmail = `owner-${suffix}@example.com`;
  let token = '';
  let orgId = '';
  let workspaceId = '';
  let projectId = '';
  let issueId = '';

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('reports liveness and readiness', async () => {
    await request(ctx.http).get('/api/v1/health').expect(200);
    const ready = await request(ctx.http).get('/api/v1/health/ready').expect(200);
    expect(ready.body.status).toBe('ready');
    expect(ready.body.checks.database.up).toBe(true);
    expect(ready.body.checks.redis.up).toBe(true);
  });

  it('registers a user and never returns the password hash', async () => {
    const res = await request(ctx.http)
      .post('/api/v1/auth/register')
      .send({ name: 'E2E Owner', email: ownerEmail, password: 'correct-horse-battery' })
      .expect(201);

    expect(res.body.user.email).toBe(ownerEmail);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    token = res.body.accessToken;

    const me = await request(ctx.http).get('/api/v1/auth/me').set(bearer(token)).expect(200);
    expect(me.body.email).toBe(ownerEmail);
  });

  it('rejects unauthenticated access to org routes', async () => {
    await request(ctx.http).get('/api/v1/organizations').expect(401);
  });

  it('creates an organization, workspace, project and issue', async () => {
    const org = await request(ctx.http)
      .post('/api/v1/organizations')
      .set(bearer(token))
      .send({ name: 'E2E Acme', slug: `acme-${suffix}` })
      .expect(201);
    orgId = org.body.id;
    expect(orgId).toBeTruthy();

    const list = await request(ctx.http).get('/api/v1/organizations').set(bearer(token)).expect(200);
    expect(list.body.some((o: { id: string }) => o.id === orgId)).toBe(true);

    const ws = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/workspaces`)
      .set(bearer(token))
      .send({ name: 'Engineering', slug: 'engineering' })
      .expect(201);
    workspaceId = ws.body.id;

    const project = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects`)
      .set(bearer(token))
      .send({ name: 'E2E Project', key: 'E2E' })
      .expect(201);
    projectId = project.body.id;

    const issue = await request(ctx.http)
      .post(`/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects/${projectId}/issues`)
      .set(bearer(token))
      .send({ title: 'Ship the integration', type: 'TASK', priority: 'HIGH' })
      .expect(201);
    issueId = issue.body.id;
    expect(issue.body.number).toBe(1);

    // Filterable listing returns the issue.
    const filtered = await request(ctx.http)
      .get(
        `/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects/${projectId}/issues?status=BACKLOG`,
      )
      .set(bearer(token))
      .expect(200);
    expect(filtered.body.map((i: { id: string }) => i.id)).toContain(issueId);
  });

  it('comments on and transitions the issue', async () => {
    await request(ctx.http)
      .post(
        `/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects/${projectId}/issues/${issueId}/comments`,
      )
      .set(bearer(token))
      .send({ body: 'Looks good to me' })
      .expect(201);

    const updated = await request(ctx.http)
      .patch(
        `/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects/${projectId}/issues/${issueId}`,
      )
      .set(bearer(token))
      .send({ status: 'DONE' })
      .expect(200);
    expect(updated.body.status).toBe('DONE');

    const detail = await request(ctx.http)
      .get(
        `/api/v1/organizations/${orgId}/workspaces/${workspaceId}/projects/${projectId}/issues/${issueId}`,
      )
      .set(bearer(token))
      .expect(200);
    expect(detail.body.comments).toHaveLength(1);
    expect(detail.body.comments[0].body).toBe('Looks good to me');
  });

  it('writes an immutable audit trail', async () => {
    const res = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/audit-logs?pageSize=100`)
      .set(bearer(token))
      .expect(200);
    const actions = res.body.items.map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['organization.created', 'workspace.created', 'project.created']),
    );
  });

  it('exposes billing plans, usage and the default FREE subscription', async () => {
    const plans = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/billing/plans`)
      .set(bearer(token))
      .expect(200);
    expect(plans.body.map((p: { tier: string }) => p.tier)).toEqual(['FREE', 'PRO', 'ENTERPRISE']);

    const usage = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/billing/usage`)
      .set(bearer(token))
      .expect(200);
    expect(usage.body.plan).toBe('FREE');
    expect(usage.body.usage.projects.used).toBe(1);

    const sub = await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/billing/subscription`)
      .set(bearer(token))
      .expect(200);
    expect(sub.body.plan).toBe('FREE');
  });

  it('does not leak an organization to a non-member', async () => {
    const outsider = await request(ctx.http)
      .post('/api/v1/auth/register')
      .send({ name: 'Outsider', email: `outsider-${suffix}@example.com`, password: 'correct-horse-battery' })
      .expect(201);

    await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}`)
      .set(bearer(outsider.body.accessToken))
      .expect(404);

    await request(ctx.http)
      .get(`/api/v1/organizations/${orgId}/audit-logs`)
      .set(bearer(outsider.body.accessToken))
      .expect(404);
  });
});
