/**
 * End-to-end SQA harness for a running rant instance.
 *
 *   pnpm --filter @rant/api sqa
 *
 * Requires the API (and ideally the web app) to be running, plus the database
 * in .env. It creates its own org/users ("SQA Corp") so it never mutates the
 * seeded demo. Everything is asserted through the public HTTP API; the database
 * is read only for invitation tokens and a few ripple checks.
 */
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { io } from 'socket.io-client';
import db from '@rant/database';

const { PrismaClient } = db;

const BASE = process.env.SQA_BASE ?? 'http://127.0.0.1:4000/api/v1';
const WEB = process.env.SQA_WEB ?? 'http://127.0.0.1:3000';
const prisma = new PrismaClient();
const suffix = Date.now().toString(36);
const results = [];
let currentArea = 'setup';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function area(name) {
  currentArea = name;
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ area: currentArea, name, ok: true });
    console.log(`PASS  ${currentArea} :: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ area: currentArea, name, ok: false, error: message });
    console.log(`FAIL  ${currentArea} :: ${name}\n      ${message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(res, allowed, label) {
  const ok = Array.isArray(allowed) ? allowed.includes(res.status) : res.status === allowed;
  if (!ok) {
    throw new Error(
      `${label}: expected ${allowed}, got ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`,
    );
  }
}

async function call(method, path, opts = {}) {
  const { token, apiKey, body, raw, headers = {} } = opts;
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (apiKey) init.headers['X-API-Key'] = apiKey;
  if (raw !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = raw;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(`${BASE}${path}`, init);
    if (res.status !== 429 || attempt >= 2) break;
    console.log('      (rate limited — waiting 30s)');
    await sleep(30_000);
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

async function waitFor(read, done, label, timeoutMs = 45_000, intervalMs = 700) {
  const started = Date.now();
  let value = await read();
  while (!done(value)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}. Last: ${JSON.stringify(value)?.slice(0, 400)}`);
    }
    await sleep(intervalMs);
    value = await read();
  }
  return value;
}

function sign(secret, raw, algorithm = 'sha256') {
  return createHmac(algorithm, secret).update(raw).digest('hex');
}

function startWebhookSink() {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      received.push({ headers: req.headers, raw });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, received, url: `http://127.0.0.1:${server.address().port}/hook` });
    });
  });
}

const S = {};

async function main() {
  console.log(`\nrant SQA — ${new Date().toISOString()}\nAPI ${BASE}\nWEB ${WEB}\n`);

  // ── Health ────────────────────────────────────────────────
  area('health');
  await test('liveness returns ok', async () => {
    const res = await call('GET', '/health');
    expectStatus(res, 200, 'health');
    assert(res.body.status === 'ok', 'status should be ok');
  });
  await test('readiness reports database + redis up', async () => {
    const res = await call('GET', '/health/ready');
    expectStatus(res, 200, 'ready');
    assert(res.body.checks.database.up === true, 'database should be up');
    assert(res.body.checks.redis.up === true, 'redis should be up');
  });

  // ── Auth ──────────────────────────────────────────────────
  area('auth');
  const ownerEmail = `sqa-owner-${suffix}@example.com`;
  const password = 'SqaPassw0rd!';

  await test('register returns a user + tokens, never a password hash', async () => {
    const res = await call('POST', '/auth/register', {
      body: { name: 'SQA Owner', email: ownerEmail, password },
    });
    expectStatus(res, 201, 'register');
    assert(res.body.user?.email === ownerEmail, 'email mismatch');
    assert(!('passwordHash' in (res.body.user ?? {})), 'password hash leaked');
    S.token = res.body.accessToken;
    S.refreshToken = res.body.refreshToken;
    S.ownerId = res.body.user.id;
  });

  await test('duplicate registration is rejected', async () => {
    const res = await call('POST', '/auth/register', {
      body: { name: 'SQA Owner', email: ownerEmail, password },
    });
    expectStatus(res, 409, 'duplicate register');
  });

  await test('wrong password is rejected', async () => {
    const res = await call('POST', '/auth/login', { body: { email: ownerEmail, password: 'wrong-pass' } });
    expectStatus(res, 401, 'bad login');
  });

  await test('login returns a fresh token pair', async () => {
    const res = await call('POST', '/auth/login', { body: { email: ownerEmail, password } });
    expectStatus(res, 200, 'login');
    assert(res.body.accessToken && res.body.refreshToken, 'missing tokens');
    S.token = res.body.accessToken;
    S.refreshToken = res.body.refreshToken;
  });

  await test('me reflects the authenticated user', async () => {
    const res = await call('GET', '/auth/me', { token: S.token });
    expectStatus(res, 200, 'me');
    assert(res.body.email === ownerEmail, 'wrong user');
  });

  await test('refresh rotates the token and rejects replay', async () => {
    const used = S.refreshToken;
    const res = await call('POST', '/auth/refresh', { body: { refreshToken: used } });
    expectStatus(res, 200, 'refresh');
    assert(res.body.refreshToken !== used, 'refresh token did not rotate');
    S.token = res.body.accessToken;
    S.refreshToken = res.body.refreshToken;

    const replay = await call('POST', '/auth/refresh', { body: { refreshToken: used } });
    expectStatus(replay, 401, 'refresh replay');
  });

  await test('unauthenticated org access is rejected', async () => {
    const res = await call('GET', '/organizations');
    expectStatus(res, 401, 'unauthenticated');
  });

  // ── Organizations / workspaces / projects ─────────────────
  area('planning');
  await test('create organization', async () => {
    const res = await call('POST', '/organizations', {
      token: S.token,
      body: { name: `SQA Corp ${suffix}`, slug: `sqa-${suffix}` },
    });
    expectStatus(res, 201, 'create org');
    S.orgId = res.body.id;
    assert(S.orgId, 'missing org id');
  });

  await test('organization is listed and readable', async () => {
    const list = await call('GET', '/organizations', { token: S.token });
    expectStatus(list, 200, 'list orgs');
    assert(list.body.some((o) => o.id === S.orgId), 'org not listed');
    const one = await call('GET', `/organizations/${S.orgId}`, { token: S.token });
    expectStatus(one, 200, 'get org');
  });

  await test('update organization name', async () => {
    const res = await call('PATCH', `/organizations/${S.orgId}`, {
      token: S.token,
      body: { name: 'SQA Corp (QA)' },
    });
    expectStatus(res, 200, 'update org');
    assert(res.body.name === 'SQA Corp (QA)', 'name not updated');
  });

  await test('create workspace', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/workspaces`, {
      token: S.token,
      body: { name: 'Quality', slug: 'quality' },
    });
    expectStatus(res, 201, 'create workspace');
    S.wsId = res.body.id;
  });

  await test('create project and reject a duplicate key', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects`, {
      token: S.token,
      body: { name: 'SQA Project', key: 'SQA', description: 'Quality engineering' },
    });
    expectStatus(res, 201, 'create project');
    S.projectId = res.body.id;

    const dup = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects`, {
      token: S.token,
      body: { name: 'Duplicate', key: 'SQA' },
    });
    expectStatus(dup, 409, 'duplicate project key');
  });

  await test('create sprint and epic', async () => {
    const sprint = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects/${S.projectId}/sprints`, {
      token: S.token,
      body: { name: 'QA Sprint 1', goal: 'Ship verified software', status: 'ACTIVE' },
    });
    expectStatus(sprint, 201, 'create sprint');
    S.sprintId = sprint.body.id;

    const epic = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects/${S.projectId}/epics`, {
      token: S.token,
      body: { name: 'Quality', color: '#22c55e' },
    });
    expectStatus(epic, 201, 'create epic');
    S.epicId = epic.body.id;
  });

  // ── Issues & comments ─────────────────────────────────────
  const issueBase = `/organizations/${S.orgId}/workspaces/${S.wsId}/projects/${S.projectId}/issues`;
  await test('create three issues with sequential numbers', async () => {
    const one = await call('POST', issueBase, {
      token: S.token,
      body: {
        title: `SQA issue alpha ${suffix}`,
        description: 'The first SQA issue',
        type: 'TASK',
        priority: 'HIGH',
        storyPoints: 3,
        sprintId: S.sprintId,
        epicId: S.epicId,
      },
    });
    expectStatus(one, 201, 'issue 1');
    S.issue1 = one.body;
    assert(one.body.number === 1, `expected number 1, got ${one.body.number}`);

    const two = await call('POST', issueBase, {
      token: S.token,
      body: { title: `SQA bug beta ${suffix}`, type: 'BUG', priority: 'URGENT' },
    });
    expectStatus(two, 201, 'issue 2');
    S.issue2 = two.body;

    const three = await call('POST', issueBase, {
      token: S.token,
      body: { title: `SQA story gamma ${suffix}`, type: 'STORY', priority: 'LOW' },
    });
    expectStatus(three, 201, 'issue 3');
    S.issue3 = three.body;
    assert(three.body.number === 3, `expected number 3, got ${three.body.number}`);
  });

  await test('filter issues by status and type', async () => {
    const backlog = await call('GET', `${issueBase}?status=BACKLOG`, { token: S.token });
    expectStatus(backlog, 200, 'filter backlog');
    assert(backlog.body.length >= 3, `expected >=3 backlog issues, got ${backlog.body.length}`);

    const bugs = await call('GET', `${issueBase}?type=BUG`, { token: S.token });
    expectStatus(bugs, 200, 'filter bugs');
    assert(bugs.body.some((i) => i.id === S.issue2.id), 'bug missing from type filter');
  });

  await test('update issue status, priority and assignee', async () => {
    const res = await call('PATCH', `${issueBase}/${S.issue1.id}`, {
      token: S.token,
      body: { status: 'IN_PROGRESS', priority: 'URGENT', assigneeId: S.ownerId },
    });
    expectStatus(res, 200, 'update issue');
    assert(res.body.status === 'IN_PROGRESS', 'status not applied');
    assert(res.body.assigneeId === S.ownerId, 'assignee not applied');
  });

  await test('comment on an issue and delete the comment', async () => {
    const created = await call('POST', `${issueBase}/${S.issue1.id}/comments`, {
      token: S.token,
      body: { body: 'Verified by SQA' },
    });
    expectStatus(created, 201, 'create comment');

    const detail = await call('GET', `${issueBase}/${S.issue1.id}`, { token: S.token });
    expectStatus(detail, 200, 'issue detail');
    assert(detail.body.comments.length === 1, 'comment not attached');

    const removed = await call('DELETE', `${issueBase}/${S.issue1.id}/comments/${created.body.id}`, {
      token: S.token,
    });
    expectStatus(removed, 200, 'delete comment');
  });

  await test('create a subtask linked to a parent', async () => {
    const res = await call('POST', issueBase, {
      token: S.token,
      body: { title: `SQA subtask ${suffix}`, type: 'SUBTASK', parentId: S.issue1.id },
    });
    expectStatus(res, 201, 'create subtask');
    assert(res.body.parentId === S.issue1.id, 'parent not set');
  });

  // ── Invitations, members, RBAC ────────────────────────────
  area('rbac');
  const devEmail = `sqa-dev-${suffix}@example.com`;
  const devopsEmail = `sqa-devops-${suffix}@example.com`;

  await test('invite a developer by email', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/invitations`, {
      token: S.token,
      body: { email: devEmail, role: 'DEVELOPER' },
    });
    expectStatus(res, 201, 'invite developer');
    const row = await prisma.invitation.findFirst({
      where: { organizationId: S.orgId, email: devEmail },
      orderBy: { createdAt: 'desc' },
    });
    assert(row?.token, 'invitation token not persisted');
    S.devInvite = row.token;
  });

  await test('invitation preview is public and correct', async () => {
    const res = await call('GET', `/invitations/${S.devInvite}`);
    expectStatus(res, 200, 'preview invite');
    assert(res.body.role === 'DEVELOPER', 'wrong role in preview');
    assert(res.body.expired === false, 'invitation should not be expired');
  });

  await test('invitee registers and accepts, becoming a member', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { name: 'SQA Developer', email: devEmail, password },
    });
    expectStatus(reg, 201, 'register invitee');
    S.devToken = reg.body.accessToken;

    const accept = await call('POST', `/invitations/${S.devInvite}/accept`, { token: S.devToken });
    expectStatus(accept, [200, 201], 'accept invite');
    assert(accept.body.role === 'DEVELOPER', 'wrong accepted role');

    const members = await call('GET', `/organizations/${S.orgId}/members`, { token: S.token });
    expectStatus(members, 200, 'members');
    assert(members.body.some((m) => m.user.email === devEmail), 'invitee not in members');
  });

  await test('invite a devops member and accept', async () => {
    const inv = await call('POST', `/organizations/${S.orgId}/invitations`, {
      token: S.token,
      body: { email: devopsEmail, role: 'DEVOPS' },
    });
    expectStatus(inv, 201, 'invite devops');
    const row = await prisma.invitation.findFirst({
      where: { organizationId: S.orgId, email: devopsEmail },
      orderBy: { createdAt: 'desc' },
    });
    const reg = await call('POST', '/auth/register', {
      body: { name: 'SQA DevOps', email: devopsEmail, password },
    });
    expectStatus(reg, 201, 'register devops');
    S.devopsToken = reg.body.accessToken;
    const accept = await call('POST', `/invitations/${row.token}/accept`, { token: S.devopsToken });
    expectStatus(accept, [200, 201], 'accept devops invite');
  });

  await test('cannot invite someone as OWNER', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/invitations`, {
      token: S.token,
      body: { email: `sqa-owner2-${suffix}@example.com`, role: 'OWNER' },
    });
    expectStatus(res, 400, 'invite owner');
  });

  await test('free-plan seat limit blocks a fourth member', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/invitations`, {
      token: S.token,
      body: { email: `sqa-extra-${suffix}@example.com`, role: 'VIEWER' },
    });
    expectStatus(res, 403, 'seat limit');
  });

  await test('developer cannot perform manager-only actions', async () => {
    const res = await call('PATCH', `/organizations/${S.orgId}/repositories/does-not-matter`, {
      token: S.devToken,
      body: { name: 'x' },
    });
    expectStatus(res, 403, 'developer PATCH repo');
  });

  await test('non-member cannot read the organization', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { name: 'SQA Outsider', email: `sqa-out-${suffix}@example.com`, password },
    });
    // If the auth route is throttled, registration may 429 — treat that as a
    // skip rather than a failure of tenancy.
    if (reg.status === 429) return;
    expectStatus(reg, 201, 'register outsider');
    const res = await call('GET', `/organizations/${S.orgId}`, { token: reg.body.accessToken });
    expectStatus(res, 404, 'outsider org read');
  });

  // ── Billing gates ─────────────────────────────────────────
  area('billing');
  await test('free plan gates the third repository', async () => {
    const mk = (name) =>
      call('POST', `/organizations/${S.orgId}/repositories`, {
        token: S.token,
        body: { name, slug: name, projectId: S.projectId },
      });
    const a = await mk('sqa-app');
    expectStatus(a, 201, 'repo A');
    S.repoA = a.body;
    const b = await mk('sqa-gate');
    expectStatus(b, 201, 'repo B');
    S.repoB = b.body;
    const c = await mk('sqa-real');
    expectStatus(c, 403, 'repo C over limit');
  });

  await test('free plan gates the third project', async () => {
    const second = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects`, {
      token: S.token,
      body: { name: 'SQA Project Two', key: 'SQB' },
    });
    expectStatus(second, 201, 'second project');
    const third = await call('POST', `/organizations/${S.orgId}/workspaces/${S.wsId}/projects`, {
      token: S.token,
      body: { name: 'SQA Project Three', key: 'SQC' },
    });
    expectStatus(third, 403, 'third project over limit');
  });

  await test('usage reflects plan and counts', async () => {
    const res = await call('GET', `/organizations/${S.orgId}/billing/usage`, { token: S.token });
    expectStatus(res, 200, 'usage');
    assert(res.body.plan === 'FREE', 'expected FREE');
    assert(res.body.usage.repositories.used === 2, 'expected 2 repos');
    assert(res.body.usage.members.used === 3, 'expected 3 members');
  });

  await test('upgrade to PRO mints an invoice and lifts limits', async () => {
    const upgrade = await call('POST', `/organizations/${S.orgId}/billing/subscription`, {
      token: S.token,
      body: { plan: 'PRO' },
    });
    expectStatus(upgrade, [200, 201], 'upgrade');
    assert(upgrade.body.plan === 'PRO', 'plan not PRO');

    const invoices = await call('GET', `/organizations/${S.orgId}/billing/invoices`, { token: S.token });
    expectStatus(invoices, 200, 'invoices');
    assert(invoices.body.some((i) => i.amountCents === 2900), 'missing PRO invoice');

    const repo = await call('POST', `/organizations/${S.orgId}/repositories`, {
      token: S.token,
      body: { name: 'sqa-real', slug: 'sqa-real', projectId: S.projectId },
    });
    expectStatus(repo, 201, 'repo C after upgrade');
    S.repoC = repo.body;
  });

  await test('cancel then resume the subscription', async () => {
    const cancelled = await call('POST', `/organizations/${S.orgId}/billing/subscription/cancel`, {
      token: S.token,
    });
    expectStatus(cancelled, [200, 201], 'cancel');
    assert(cancelled.body.cancelAtPeriodEnd === true, 'cancelAtPeriodEnd not set');
    const resumed = await call('POST', `/organizations/${S.orgId}/billing/subscription/resume`, {
      token: S.token,
    });
    expectStatus(resumed, [200, 201], 'resume');
    assert(resumed.body.cancelAtPeriodEnd === false, 'cancelAtPeriodEnd not cleared');
  });

  // ── Repositories: branches, commits, tags, releases ───────
  area('repositories');
  const repoPath = (repoId) => `/organizations/${S.orgId}/repositories/${repoId}`;
  await test('repository has a default branch and production environment', async () => {
    const branches = await call('GET', `${repoPath(S.repoA.id)}/branches`, { token: S.token });
    expectStatus(branches, 200, 'branches');
    assert(branches.body.some((b) => b.name === 'main' && b.isDefault), 'missing default branch');

    const envs = await call('GET', `${repoPath(S.repoA.id)}/environments`, { token: S.token });
    expectStatus(envs, 200, 'environments');
    assert(envs.body.some((e) => e.isProduction && e.branchFilter === 'main'), 'missing production env');
  });

  await test('duplicate repository slug is rejected', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/repositories`, {
      token: S.token,
      body: { name: 'sqa-app', slug: 'sqa-app' },
    });
    expectStatus(res, 409, 'duplicate slug');
  });

  await test('create branch and commit, advancing the head', async () => {
    const branch = await call('POST', `${repoPath(S.repoA.id)}/branches`, {
      token: S.token,
      body: { name: 'feature/sqa', fromBranch: 'main' },
    });
    expectStatus(branch, 201, 'create branch');

    const commit = await call('POST', `${repoPath(S.repoA.id)}/commits`, {
      token: S.token,
      body: { branch: 'feature/sqa', message: 'feat: add SQA coverage' },
    });
    expectStatus(commit, 201, 'create commit');
    S.commit = commit.body;

    const branches = await call('GET', `${repoPath(S.repoA.id)}/branches`, { token: S.token });
    const refreshed = branches.body.find((b) => b.name === 'feature/sqa');
    assert(refreshed.headCommitSha === commit.body.sha, 'branch head not advanced');
  });

  await test('create tag and release from the commit', async () => {
    const tag = await call('POST', `${repoPath(S.repoA.id)}/tags`, {
      token: S.token,
      body: { name: 'v0.0.1', commitSha: S.commit.sha },
    });
    expectStatus(tag, 201, 'create tag');

    const release = await call('POST', `${repoPath(S.repoA.id)}/releases`, {
      token: S.token,
      body: { tagName: 'v0.0.1', name: 'SQA Release', body: 'First SQA release' },
    });
    expectStatus(release, 201, 'create release');
    assert(release.body.tagName === 'v0.0.1', 'release tag mismatch');
  });

  // ── Webhook sink (before deploy/incident so deliveries are captured) ──
  area('webhooks');
  S.sink = await startWebhookSink();
  await test('register an outbound webhook endpoint', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/webhooks`, {
      token: S.token,
      body: {
        url: S.sink.url,
        events: ['deployment.completed', 'incident.opened', 'incident.resolved'],
      },
    });
    expectStatus(res, 201, 'create webhook');
    S.webhook = res.body;
    assert(res.body.secret?.startsWith('whsec_'), 'webhook secret missing');
  });

  // ── CI/CD: pipeline, run, deploy ──────────────────────────
  area('ci-cd');
  await test('create a pipeline and run it to success', async () => {
    const pipeline = await call('POST', `${repoPath(S.repoA.id)}/pipelines`, {
      token: S.token,
      body: { name: 'ci', triggers: ['PUSH', 'PULL_REQUEST'] },
    });
    expectStatus(pipeline, 201, 'create pipeline');
    S.pipelineA = pipeline.body;

    const run = await call('POST', `${repoPath(S.repoA.id)}/pipelines/${pipeline.body.id}/run`, {
      token: S.token,
      body: { branch: 'main' },
    });
    expectStatus(run, 201, 'trigger run');
    S.runA = run.body;

    const finished = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/runs/${S.runA.id}`, { token: S.token })).body,
      (r) => r && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(r.status),
      'pipeline run terminal',
    );
    assert(finished.status === 'SUCCESS', `run ended ${finished.status}`);
    assert(finished.jobs.length === 2, `expected 2 jobs, got ${finished.jobs.length}`);
    const steps = finished.jobs.flatMap((j) => j.steps);
    assert(steps.every((s) => s.status === 'SUCCESS'), 'not all steps succeeded');
    assert(steps.some((s) => s.logs.includes('✓')), 'step logs missing output');
  });

  await test('run logs stream over SSE', async () => {
    const controller = new AbortController();
    const res = await fetch(`${BASE}${repoPath(S.repoA.id)}/runs/${S.runA.id}/stream`, {
      headers: { Authorization: `Bearer ${S.token}` },
      signal: controller.signal,
    });
    expectStatus({ status: res.status, body: '' }, 200, 'run stream');
    assert((res.headers.get('content-type') ?? '').includes('text/event-stream'), 'not an SSE response');
    const reader = res.body.getReader();
    const chunk = await Promise.race([reader.read(), sleep(5000).then(() => null)]);
    controller.abort();
    assert(chunk && !chunk.done, 'no SSE frame received');
  });

  await test('green run auto-deploys to production', async () => {
    const deployments = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/deployments`, { token: S.token })).body,
      (list) => Array.isArray(list) && list.some((d) => d.status === 'READY'),
      'auto deployment READY',
      60_000,
    );
    S.deployment = deployments.find((d) => d.status === 'READY' && d.environment?.isProduction);
    assert(S.deployment, 'no READY production deployment');
    assert(S.deployment.url?.startsWith('http'), 'deployment has no URL');

    const envs = await call('GET', `${repoPath(S.repoA.id)}/environments`, { token: S.token });
    const prod = envs.body.find((e) => e.isProduction);
    assert(prod.currentDeploymentId === S.deployment.id, 'environment currentDeployment not advanced');
  });

  await test('deployment logs and detail are available', async () => {
    const res = await call('GET', `${repoPath(S.repoA.id)}/deployments/${S.deployment.id}`, {
      token: S.token,
    });
    expectStatus(res, 200, 'deployment detail');
    assert(res.body.logs.includes('Building'), 'deployment logs missing');
  });

  await test('manual staging deploy, rollback and cancel', async () => {
    const env = await call('POST', `${repoPath(S.repoA.id)}/environments`, {
      token: S.token,
      body: { name: 'Staging', slug: 'staging', type: 'STAGING', branchFilter: 'main' },
    });
    expectStatus(env, 201, 'create staging env');

    const deploy = await call('POST', `${repoPath(S.repoA.id)}/environments/${env.body.id}/deploy`, {
      token: S.token,
      body: { branch: 'main' },
    });
    expectStatus(deploy, 201, 'manual deploy');
    const ready = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/deployments/${deploy.body.id}`, { token: S.token })).body,
      (d) => d?.status === 'READY',
      'staging deployment ready',
    );
    assert(ready.url, 'staging deployment has no URL');

    const rollback = await call('POST', `${repoPath(S.repoA.id)}/environments/${env.body.id}/rollback`, {
      token: S.token,
      body: { deploymentId: ready.id },
    });
    expectStatus(rollback, 201, 'rollback');
    await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/deployments/${rollback.body.id}`, { token: S.token })).body,
      (d) => d?.status === 'READY',
      'rollback deployment ready',
    );

    const cancelTarget = await call('POST', `${repoPath(S.repoA.id)}/environments/${env.body.id}/deploy`, {
      token: S.token,
      body: { branch: 'main' },
    });
    const cancelled = await call(
      'POST',
      `${repoPath(S.repoA.id)}/deployments/${cancelTarget.body.id}/cancel`,
      { token: S.token },
    );
    expectStatus(cancelled, [200, 201], 'cancel deployment');
    assert(cancelled.body.status === 'CANCELLED', 'deployment not cancelled');
  });

  // ── Monitoring / incidents / ripple ───────────────────────
  area('monitoring');
  await test('monitor is created and targets the live URL', async () => {
    const monitors = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/monitors`, { token: S.token })).body,
      (list) => Array.isArray(list) && list.some((m) => m.target && m.environment?.isProduction),
      'monitor with target',
      30_000,
    );
    S.monitor = monitors.find((m) => m.environment?.isProduction);
    assert(S.monitor.target === S.deployment.url, 'monitor target does not match deployment URL');
  });

  await test('metrics endpoint returns samples and a rollup', async () => {
    const res = await call('GET', `${repoPath(S.repoA.id)}/monitors/${S.monitor.id}/metrics`, {
      token: S.token,
    });
    expectStatus(res, 200, 'metrics');
    assert(Array.isArray(res.body.samples), 'samples missing');
    assert(typeof res.body.summary.uptimePct === 'number', 'summary missing');
  });

  await test('simulated outage opens a CRITICAL incident + bug issue', async () => {
    const sim = await call('POST', `${repoPath(S.repoA.id)}/monitors/${S.monitor.id}/simulate`, {
      token: S.token,
      body: { kind: 'outage', durationSec: 60 },
    });
    expectStatus(sim, [200, 201], 'simulate outage');

    const incidents = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/incidents`, { token: S.token })).body,
      (list) => Array.isArray(list) && list.some((i) => i.status === 'OPEN' && i.monitor?.id === S.monitor.id),
      'incident OPEN',
      75_000,
      1000,
    );
    S.incident = incidents.find((i) => i.status === 'OPEN' && i.monitor?.id === S.monitor.id);
    assert(S.incident.severity === 'CRITICAL', `expected CRITICAL, got ${S.incident.severity}`);
    assert(S.incident.issueId, 'incident did not file a bug issue');

    const bug = await call('GET', `${issueBase}/${S.incident.issueId}`, { token: S.token });
    expectStatus(bug, 200, 'bug issue');
    assert(bug.body.type === 'BUG', 'linked issue is not a BUG');
  });

  await test('incident drafts a postmortem doc in the workspace', async () => {
    const docs = await waitFor(
      async () =>
        (
          await call('GET', `/organizations/${S.orgId}/workspaces/${S.wsId}/docs`, { token: S.token })
        ).body,
      (list) => Array.isArray(list) && list.some((d) => d.title.startsWith('Postmortem:')),
      'postmortem doc',
      30_000,
    );
    S.postmortem = docs.find((d) => d.title.startsWith('Postmortem:'));
    assert(S.postmortem, 'postmortem not found');
  });

  await test('incident fans out notifications, chat and a signed webhook', async () => {
    const notes = await waitFor(
      async () => (await call('GET', '/notifications', { token: S.token })).body,
      (list) => Array.isArray(list) && list.some((n) => n.type === 'INCIDENT_OPENED'),
      'incident notification',
    );
    assert(notes.some((n) => n.type === 'INCIDENT_OPENED'), 'no incident notification');

    const channels = await call('GET', `/organizations/${S.orgId}/channels`, { token: S.token });
    const activity = channels.body.find((c) => c.isSystem);
    const messages = await call('GET', `/organizations/${S.orgId}/channels/${activity.id}/messages`, {
      token: S.token,
    });
    assert(
      messages.body.some((m) => m.kind === 'SYSTEM' && /incident/i.test(m.body)),
      'no incident system message in #activity',
    );

    const delivery = await waitFor(
      async () => S.sink.received.find((r) => r.headers['x-rant-event'] === 'incident.opened'),
      (d) => Boolean(d),
      'incident.opened webhook',
      30_000,
    );
    assert(
      delivery.headers['x-rant-signature'] === `sha256=${sign(S.webhook.secret, delivery.raw)}`,
      'webhook signature mismatch',
    );
    const payload = JSON.parse(delivery.raw);
    assert(payload.event === 'incident.opened', 'webhook event mismatch');
    assert(payload.data.incidentId === S.incident.id, 'webhook incident id mismatch');
  });

  await test('deployment webhook was delivered and signed', async () => {
    const delivery = await waitFor(
      async () => S.sink.received.find((r) => r.headers['x-rant-event'] === 'deployment.completed'),
      (d) => Boolean(d),
      'deployment.completed webhook',
      30_000,
    );
    assert(
      delivery.headers['x-rant-signature'] === `sha256=${sign(S.webhook.secret, delivery.raw)}`,
      'deployment webhook signature mismatch',
    );
  });

  await test('recovery resolves the incident and closes the bug', async () => {
    const sim = await call('POST', `${repoPath(S.repoA.id)}/monitors/${S.monitor.id}/simulate`, {
      token: S.token,
      body: { kind: 'recover' },
    });
    expectStatus(sim, [200, 201], 'simulate recover');

    const resolved = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/incidents/${S.incident.id}`, { token: S.token })).body,
      (i) => i?.status === 'RESOLVED',
      'incident RESOLVED',
      60_000,
    );
    assert(resolved.resolvedAt, 'resolvedAt not set');

    const bug = await call('GET', `${issueBase}/${S.incident.issueId}`, { token: S.token });
    assert(bug.body.status === 'DONE', `bug issue is ${bug.body.status}, expected DONE`);
  });

  await test('webhook deliveries are recorded as successes', async () => {
    const res = await call('GET', `/organizations/${S.orgId}/webhooks/${S.webhook.id}/deliveries`, {
      token: S.token,
    });
    expectStatus(res, 200, 'webhook deliveries');
    assert(res.body.length >= 2, 'expected at least 2 deliveries');
    assert(res.body.every((d) => d.status === 'SUCCESS'), 'a delivery failed');
  });

  // ── Pull requests: failing gate + successful merge + queue ──
  area('pull-requests');
  await test('failing CI blocks the merge with 409', async () => {
    const pipeline = await call('POST', `${repoPath(S.repoB.id)}/pipelines`, {
      token: S.token,
      body: {
        name: 'gate',
        triggers: ['PULL_REQUEST'],
        definition: { jobs: [{ name: 'check', steps: [{ name: 'fail', run: 'exit 1' }] }] },
      },
    });
    expectStatus(pipeline, 201, 'gate pipeline');

    const branch = await call('POST', `${repoPath(S.repoB.id)}/branches`, {
      token: S.token,
      body: { name: 'feature/gate', fromBranch: 'main' },
    });
    expectStatus(branch, 201, 'gate branch');
    await call('POST', `${repoPath(S.repoB.id)}/commits`, {
      token: S.token,
      body: { branch: 'feature/gate', message: 'feat: gate change' },
    });

    const pr = await call('POST', `${repoPath(S.repoB.id)}/pulls`, {
      token: S.token,
      body: { title: 'Gate PR', sourceBranch: 'feature/gate' },
    });
    expectStatus(pr, 201, 'gate PR');
    S.gatePr = pr.body;

    await waitFor(
      async () => (await call('GET', `${repoPath(S.repoB.id)}/runs`, { token: S.token })).body,
      (runs) => Array.isArray(runs) && runs.some((r) => r.status === 'FAILED'),
      'failing PR run',
    );

    await call('POST', `${repoPath(S.repoB.id)}/pulls/${pr.body.number}/reviews`, {
      token: S.token,
      body: { state: 'APPROVED', body: 'Looks OK but CI is red' },
    });
    const merge = await call('POST', `${repoPath(S.repoB.id)}/pulls/${pr.body.number}/merge`, {
      token: S.token,
    });
    expectStatus(merge, 409, 'merge blocked');
    assert(/CI/.test(merge.body.message ?? ''), '409 missing CI reason');
  });

  await test('green PR merges and records a merge commit', async () => {
    const branch = await call('POST', `${repoPath(S.repoA.id)}/branches`, {
      token: S.token,
      body: { name: 'feature/ok', fromBranch: 'main' },
    });
    expectStatus(branch, 201, 'ok branch');
    await call('POST', `${repoPath(S.repoA.id)}/commits`, {
      token: S.token,
      body: { branch: 'feature/ok', message: 'feat: merge me' },
    });
    const pr = await call('POST', `${repoPath(S.repoA.id)}/pulls`, {
      token: S.token,
      body: { title: 'Green PR', sourceBranch: 'feature/ok' },
    });
    expectStatus(pr, 201, 'green PR');
    await call('POST', `${repoPath(S.repoA.id)}/pulls/${pr.body.number}/reviews`, {
      token: S.token,
      body: { state: 'APPROVED' },
    });
    await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/runs`, { token: S.token })).body,
      (runs) =>
        Array.isArray(runs) &&
        runs.some((r) => r.pullRequestId === pr.body.id && r.status === 'SUCCESS'),
      'green PR run',
    );
    const merge = await call('POST', `${repoPath(S.repoA.id)}/pulls/${pr.body.number}/merge`, {
      token: S.token,
    });
    expectStatus(merge, [200, 201], 'merge green PR');
    assert(merge.body.status === 'MERGED', 'PR not merged');
    assert(merge.body.mergeCommitSha, 'merge commit SHA missing');
  });

  await test('merge queue enqueues, lists and processes', async () => {
    const branch = await call('POST', `${repoPath(S.repoA.id)}/branches`, {
      token: S.token,
      body: { name: 'feature/queue', fromBranch: 'main' },
    });
    expectStatus(branch, 201, 'queue branch');
    await call('POST', `${repoPath(S.repoA.id)}/commits`, {
      token: S.token,
      body: { branch: 'feature/queue', message: 'feat: queue me' },
    });
    const pr = await call('POST', `${repoPath(S.repoA.id)}/pulls`, {
      token: S.token,
      body: { title: 'Queued PR', sourceBranch: 'feature/queue' },
    });
    expectStatus(pr, 201, 'queue PR');

    const enqueue = await call('POST', `${repoPath(S.repoA.id)}/pulls/${pr.body.number}/queue`, {
      token: S.token,
    });
    expectStatus(enqueue, [200, 201], 'enqueue');
    const queue = await call('GET', `${repoPath(S.repoA.id)}/merge-queue`, { token: S.token });
    expectStatus(queue, 200, 'list queue');
    assert(queue.body.some((p) => p.number === pr.body.number), 'PR not in queue');

    await waitFor(
      async () => (await call('GET', `${repoPath(S.repoA.id)}/runs`, { token: S.token })).body,
      (runs) =>
        Array.isArray(runs) &&
        runs.some((r) => r.pullRequestId === pr.body.id && r.status === 'SUCCESS'),
      'queued PR run',
    );
    const processed = await call('POST', `${repoPath(S.repoA.id)}/merge-queue/process`, {
      token: S.token,
    });
    expectStatus(processed, [200, 201], 'process queue');
    assert(processed.body.merged.includes(pr.body.number), 'PR was not merged by the queue');
  });

  // ── Real integrations (Vercel + Sentry) ───────────────────
  area('integrations');
  await test('link a Vercel project to repo C', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/integrations/vercel/links`, {
      token: S.token,
      body: {
        repositoryId: S.repoC.id,
        externalProjectId: `prj_sqa_${suffix}`,
        externalProjectName: 'sqa-real',
      },
    });
    expectStatus(res, 201, 'vercel link');
  });

  await test('signed Vercel deployment becomes a READY deployment', async () => {
    const body = JSON.stringify({
      type: 'deployment.ready',
      payload: {
        deployment: {
          id: `dpl_sqa_${suffix}`,
          url: `sqa-${suffix}.vercel.app`,
          name: 'sqa-real',
          target: 'production',
          meta: { githubCommitRef: 'main', githubCommitSha: S.commit.sha },
        },
        project: { id: `prj_sqa_${suffix}`, name: 'sqa-real' },
      },
    });
    const res = await call('POST', '/integrations/vercel/webhook', {
      raw: body,
      headers: {
        'x-vercel-signature': sign('sqa-vercel-secret', body, 'sha1'),
        'x-vercel-id': `sqa-vercel-${suffix}`,
      },
    });
    expectStatus(res, 201, 'vercel webhook');
    assert(res.body.queued === true, 'vercel delivery not queued');

    const dep = await waitFor(
      async () =>
        (await call('GET', `${repoPath(S.repoC.id)}/deployments`, { token: S.token })).body.find(
          (d) => d.externalId === `dpl_sqa_${suffix}`,
        ),
      (d) => d?.status === 'READY',
      'vercel deployment READY',
    );
    assert(dep.source === 'VERCEL', `expected source VERCEL, got ${dep.source}`);
    assert(dep.url === `https://sqa-${suffix}.vercel.app`, 'Vercel URL not normalized');
  });

  await test('Vercel rejects a bad signature and dedupes deliveries', async () => {
    const body = JSON.stringify({ type: 'deployment.ready', payload: {} });
    const bad = await call('POST', '/integrations/vercel/webhook', {
      raw: body,
      headers: { 'x-vercel-signature': 'deadbeef', 'x-vercel-id': `bad-${suffix}` },
    });
    expectStatus(bad, 401, 'bad vercel signature');

    const replayBody = JSON.stringify({
      type: 'deployment.ready',
      payload: {
        deployment: { id: `dpl_sqa_${suffix}`, url: `sqa-${suffix}.vercel.app` },
        project: { id: `prj_sqa_${suffix}` },
      },
    });
    const replay = await call('POST', '/integrations/vercel/webhook', {
      raw: replayBody,
      headers: {
        'x-vercel-signature': sign('sqa-vercel-secret', replayBody, 'sha1'),
        'x-vercel-id': `sqa-vercel-${suffix}`,
      },
    });
    expectStatus(replay, 201, 'vercel replay');
    assert(replay.body.queued === false, 'duplicate delivery was queued');
  });

  await test('link a Sentry project and open a CRITICAL incident', async () => {
    const link = await call('POST', `/organizations/${S.orgId}/integrations/sentry/links`, {
      token: S.token,
      body: {
        repositoryId: S.repoC.id,
        externalProjectId: `4500${suffix}`,
        externalProjectName: 'sqa-real',
      },
    });
    expectStatus(link, 201, 'sentry link');

    S.sentryIssueId = `9900${suffix}`;
    const body = JSON.stringify({
      action: 'created',
      resource: 'issue',
      data: {
        issue: {
          id: S.sentryIssueId,
          title: `SQA Sentry fatal ${suffix}`,
          culprit: 'sqa.js',
          level: 'fatal',
          permalink: `https://sentry.io/issues/${S.sentryIssueId}/`,
          firstSeen: new Date().toISOString(),
          project: { id: `4500${suffix}`, slug: 'sqa-real', name: 'sqa-real' },
        },
      },
    });
    const res = await call('POST', '/integrations/sentry/webhook', {
      raw: body,
      headers: {
        'sentry-hook-resource': 'issue',
        'sentry-hook-signature': sign('sqa-sentry-secret', body),
        'request-id': `sqa-sentry-${suffix}`,
      },
    });
    expectStatus(res, 201, 'sentry webhook');
    assert(res.body.queued === true, 'sentry delivery not queued');

    const incidents = await waitFor(
      async () => (await call('GET', `${repoPath(S.repoC.id)}/incidents`, { token: S.token })).body,
      (list) => Array.isArray(list) && list.some((i) => i.externalId === S.sentryIssueId),
      'sentry incident',
    );
    S.sentryIncident = incidents.find((i) => i.externalId === S.sentryIssueId);
    assert(S.sentryIncident.source === 'SENTRY', 'wrong incident source');
    assert(S.sentryIncident.severity === 'CRITICAL', 'fatal should be CRITICAL');
    assert(S.sentryIncident.issueId, 'sentry incident did not file a bug');
  });

  await test('resolve the Sentry issue and close its bug', async () => {
    const body = JSON.stringify({
      action: 'resolved',
      resource: 'issue',
      data: {
        issue: {
          id: S.sentryIssueId,
          project: { id: `4500${suffix}` },
        },
      },
    });
    const res = await call('POST', '/integrations/sentry/webhook', {
      raw: body,
      headers: {
        'sentry-hook-resource': 'issue',
        'sentry-hook-signature': sign('sqa-sentry-secret', body),
        'request-id': `sqa-sentry-res-${suffix}`,
      },
    });
    expectStatus(res, 201, 'sentry resolve');

    const incident = await waitFor(
      async () =>
        (await call('GET', `${repoPath(S.repoC.id)}/incidents/${S.sentryIncident.id}`, { token: S.token })).body,
      (i) => i?.status === 'RESOLVED',
      'sentry incident resolved',
    );
    const bug = await call('GET', `${issueBase}/${incident.issueId}`, { token: S.token });
    assert(bug.body.status === 'DONE', 'sentry bug not closed');
  });

  // ── Realtime Socket.IO ────────────────────────────────────
  area('realtime');
  await test('authenticated socket receives incident.opened in the org room', async () => {
    const socket = io(`${BASE.replace(/\/api\/v1$/, '')}/realtime`, {
      auth: { token: S.token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('socket connect timeout')), 10_000);
        socket.once('connect', () => {
          clearTimeout(t);
          resolve();
        });
        socket.once('connect_error', reject);
      });
      const ack = await new Promise((resolve, reject) => {
        socket.timeout(5_000).emit('subscribe:org', { orgId: S.orgId }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      assert(ack.ok === true, 'org subscription rejected');

      const issueId = `9911${suffix}`;
      const body = JSON.stringify({
        action: 'created',
        resource: 'issue',
        data: {
          issue: {
            id: issueId,
            title: `SQA realtime issue ${suffix}`,
            level: 'major',
            project: { id: `4500${suffix}` },
          },
        },
      });
      const eventPromise = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no socket event')), 20_000);
        socket.once('incident.opened', (payload) => {
          clearTimeout(t);
          resolve(payload);
        });
      });
      const res = await call('POST', '/integrations/sentry/webhook', {
        raw: body,
        headers: {
          'sentry-hook-resource': 'issue',
          'sentry-hook-signature': sign('sqa-sentry-secret', body),
          'request-id': `sqa-sentry-rt-${suffix}`,
        },
      });
      expectStatus(res, 201, 'realtime trigger webhook');
      const event = await eventPromise;
      assert(event.orgId === S.orgId, 'event leaked to another org');
      assert(event.title === `SQA realtime issue ${suffix}`, 'wrong event payload');
    } finally {
      socket.disconnect();
    }
  });

  // ── Docs, search, copilot, files ──────────────────────────
  area('knowledge');
  const docsBase = `/organizations/${S.orgId}/workspaces/${S.wsId}/docs`;
  await test('create, version and restore a document', async () => {
    const created = await call('POST', docsBase, {
      token: S.token,
      body: { title: `SQA Runbook ${suffix}`, content: 'version one' },
    });
    expectStatus(created, 201, 'create doc');
    S.doc = created.body;

    await call('PATCH', `${docsBase}/${created.body.id}`, {
      token: S.token,
      body: { content: 'version two' },
    });
    await call('PATCH', `${docsBase}/${created.body.id}`, {
      token: S.token,
      body: { content: 'version three' },
    });

    const revisions = await call('GET', `${docsBase}/${created.body.id}/revisions`, { token: S.token });
    expectStatus(revisions, 200, 'revisions');
    assert(revisions.body.length >= 2, `expected >=2 revisions, got ${revisions.body.length}`);

    const oldest = revisions.body[revisions.body.length - 1];
    const restored = await call(
      'POST',
      `${docsBase}/${created.body.id}/revisions/${oldest.id}/restore`,
      { token: S.token },
    );
    expectStatus(restored, [200, 201], 'restore revision');
    assert(restored.body.content === 'version one', 'restore did not bring back the old content');
  });

  await test('unified search finds an issue and a document', async () => {
    const issueSearch = await call(
      'GET',
      `/organizations/${S.orgId}/search?q=${encodeURIComponent('alpha')}`,
      { token: S.token },
    );
    expectStatus(issueSearch, 200, 'search issue');
    assert(
      issueSearch.body.groups.some((g) => g.type === 'issue' && g.results.some((r) => r.id === S.issue1.id)),
      'issue not found in search',
    );

    const docSearch = await call(
      'GET',
      `/organizations/${S.orgId}/search?q=${encodeURIComponent('SQA Runbook')}`,
      { token: S.token },
    );
    expectStatus(docSearch, 200, 'search doc');
    assert(
      docSearch.body.groups.some((g) => g.type === 'doc' && g.results.some((r) => r.id === S.doc.id)),
      'doc not found in search',
    );
  });

  await test('save, list and delete a search', async () => {
    const created = await call('POST', `/organizations/${S.orgId}/search/saved`, {
      token: S.token,
      body: { name: 'Open bugs', query: 'type:BUG' },
    });
    expectStatus(created, 201, 'save search');
    const list = await call('GET', `/organizations/${S.orgId}/search/saved`, { token: S.token });
    assert(list.body.some((s) => s.id === created.body.id), 'saved search missing');
    const removed = await call('DELETE', `/organizations/${S.orgId}/search/saved/${created.body.id}`, {
      token: S.token,
    });
    expectStatus(removed, 200, 'delete saved search');
  });

  await test('copilot answers from live data with citations', async () => {
    const res = await call('POST', `/organizations/${S.orgId}/copilot/ask`, {
      token: S.token,
      body: { message: 'what should I work on?' },
    });
    expectStatus(res, 201, 'copilot ask');
    assert(res.body.message?.content?.length > 0, 'empty copilot answer');
    assert(Array.isArray(res.body.message.citations), 'citations missing');
    S.conversationId = res.body.conversationId;

    const convo = await call('GET', `/organizations/${S.orgId}/copilot/conversations/${S.conversationId}`, {
      token: S.token,
    });
    expectStatus(convo, 200, 'copilot conversation');
    assert(convo.body.messages.length >= 2, 'conversation not persisted');
  });

  await test('upload, list, download and delete a file', async () => {
    const form = new FormData();
    form.append('file', new Blob(['hello from SQA'], { type: 'text/plain' }), 'sqa.txt');
    form.append('targetType', 'Issue');
    form.append('targetId', S.issue1.id);
    const upload = await fetch(`${BASE}/organizations/${S.orgId}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${S.token}` },
      body: form,
    });
    const uploaded = await upload.json();
    assert(upload.status === 201, `upload failed: ${upload.status} ${JSON.stringify(uploaded)}`);
    assert(uploaded.name === 'sqa.txt', 'wrong filename');

    const list = await call(
      'GET',
      `/organizations/${S.orgId}/files?targetType=Issue&targetId=${S.issue1.id}`,
      { token: S.token },
    );
    assert(list.body.some((f) => f.id === uploaded.id), 'file not listed');

    const download = await fetch(
      `${BASE}/organizations/${S.orgId}/files/${uploaded.id}/download`,
      { headers: { Authorization: `Bearer ${S.token}` } },
    );
    assert(download.status === 200, `download failed: ${download.status}`);
    const bytes = await download.text();
    assert(bytes === 'hello from SQA', `download mismatch: ${bytes}`);

    const removed = await call('DELETE', `/organizations/${S.orgId}/files/${uploaded.id}`, {
      token: S.token,
    });
    expectStatus(removed, 200, 'delete file');
  });

  // ── API keys, analytics, audit, chat ──────────────────────
  area('platform');
  await test('API key authenticates and revoke immediately invalidates it', async () => {
    const created = await call('POST', `/organizations/${S.orgId}/api-keys`, {
      token: S.token,
      body: { name: 'SQA key', expiresInDays: 1 },
    });
    expectStatus(created, 201, 'create api key');
    assert(created.body.key?.startsWith('rant_'), 'raw key not returned once');
    const raw = created.body.key;

    const viaKey = await call('GET', '/organizations', { apiKey: raw });
    expectStatus(viaKey, 200, 'api key auth');

    const revoked = await call('DELETE', `/organizations/${S.orgId}/api-keys/${created.body.id}`, {
      token: S.token,
    });
    expectStatus(revoked, 200, 'revoke key');
    const after = await call('GET', '/organizations', { apiKey: raw });
    expectStatus(after, 401, 'revoked key auth');
  });

  await test('analytics aggregates the data we created', async () => {
    const res = await call('GET', `/organizations/${S.orgId}/analytics/overview?days=7`, {
      token: S.token,
    });
    expectStatus(res, 200, 'analytics');
    assert(res.body.totals.repositories >= 3, 'repositories not counted');
    assert(res.body.totals.deployments >= 2, 'deployments not counted');
    assert(res.body.totals.openIssues >= 1, 'open issues not counted');
    assert(res.body.ci.total >= 2, 'CI runs not counted');
    assert(res.body.incidents.total >= 1, 'incidents not counted');
  });

  await test('audit log records the important actions', async () => {
    const res = await call('GET', `/organizations/${S.orgId}/audit-logs?pageSize=100`, {
      token: S.token,
    });
    expectStatus(res, 200, 'audit');
    const actions = res.body.items.map((i) => i.action);
    for (const expected of [
      'organization.created',
      'invitation.sent',
      'repository.created',
      'pipeline.created',
      'deployment.queued',
      'incident.opened',
      'incident.resolved',
      'integration.vercel.deployment_synced',
      'integration.sentry.incident_opened',
    ]) {
      assert(actions.includes(expected), `audit missing ${expected}`);
    }
  });

  await test('chat channel create/post/list works', async () => {
    const created = await call('POST', `/organizations/${S.orgId}/channels`, {
      token: S.token,
      body: { name: `sqa-${suffix}`, topic: 'SQA channel' },
    });
    expectStatus(created, 201, 'create channel');
    const post = await call('POST', `/organizations/${S.orgId}/channels/${created.body.id}/messages`, {
      token: S.token,
      body: { body: 'SQA says hello' },
    });
    expectStatus(post, 201, 'post message');
    const messages = await call('GET', `/organizations/${S.orgId}/channels/${created.body.id}/messages`, {
      token: S.token,
    });
    assert(messages.body.some((m) => m.body === 'SQA says hello'), 'message missing');
  });

  await test('notification read flow and preferences round-trip', async () => {
    const list = await call('GET', '/notifications', { token: S.token });
    expectStatus(list, 200, 'notifications');
    const unread = list.body.find((n) => !n.readAt);
    if (unread) {
      const before = await call('GET', '/notifications/unread-count', { token: S.token });
      const marked = await call('POST', `/notifications/${unread.id}/read`, { token: S.token });
      expectStatus(marked, 200, 'mark read');
      const after = await call('GET', '/notifications/unread-count', { token: S.token });
      assert(after.body.count < before.body.count, 'unread count did not decrease');
    }

    const prefs = await call('GET', '/notifications/preferences', { token: S.token });
    expectStatus(prefs, 200, 'get prefs');
    const updated = await call('PUT', '/notifications/preferences', {
      token: S.token,
      body: {
        preferences: [{ category: 'INCIDENT', inApp: true, email: true }],
      },
    });
    expectStatus(updated, 200, 'update prefs');
    assert(
      updated.body.find((p) => p.category === 'INCIDENT')?.email === true,
      'preference not persisted',
    );
  });

  // ── UI smoke ─────────────────────────────────────────────
  area('ui');
  const uiRoutes = [
    '/login',
    '/register',
    '/dashboard',
    '/notifications',
    `/orgs/${S.orgId}`,
    `/orgs/${S.orgId}/analytics`,
    `/orgs/${S.orgId}/api`,
    `/orgs/${S.orgId}/audit`,
    `/orgs/${S.orgId}/billing`,
    `/orgs/${S.orgId}/chat`,
    `/orgs/${S.orgId}/copilot`,
    `/orgs/${S.orgId}/files`,
    `/orgs/${S.orgId}/integrations`,
    `/orgs/${S.orgId}/members`,
    `/orgs/${S.orgId}/repos`,
    `/orgs/${S.orgId}/repos/${S.repoA.id}`,
    `/orgs/${S.orgId}/repos/${S.repoA.id}/deployments`,
    `/orgs/${S.orgId}/repos/${S.repoA.id}/monitoring`,
    `/orgs/${S.orgId}/search`,
    `/orgs/${S.orgId}/workspaces/${S.wsId}/docs`,
    `/orgs/${S.orgId}/workspaces/${S.wsId}/projects/${S.projectId}`,
  ];
  for (const route of uiRoutes) {
    await test(`GET ${route}`, async () => {
      const res = await fetch(`${WEB}${route}`, { redirect: 'follow' });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const html = await res.text();
      assert(html.length > 500, 'suspiciously small page');
    });
  }

  // ── Logout ────────────────────────────────────────────────
  area('auth');
  await test('logout revokes the refresh token', async () => {
    const res = await call('POST', '/auth/logout', { body: { refreshToken: S.refreshToken } });
    expectStatus(res, [200, 201], 'logout');
    const replay = await call('POST', '/auth/refresh', { body: { refreshToken: S.refreshToken } });
    expectStatus(replay, 401, 'refresh after logout');
  });

  // ── Summary ───────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  const byArea = new Map();
  for (const r of results) {
    const stat = byArea.get(r.area) ?? { pass: 0, fail: 0 };
    if (r.ok) stat.pass += 1;
    else stat.fail += 1;
    byArea.set(r.area, stat);
  }

  console.log('\n──────── SQA SUMMARY ────────');
  for (const [name, stat] of byArea) {
    console.log(`${stat.fail === 0 ? 'PASS' : 'FAIL'}  ${name.padEnd(16)} ${stat.pass}/${stat.pass + stat.fail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed, ${failed.length} failed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`- [${f.area}] ${f.name}: ${f.error}`);
  }

  // Keep SQA data visible in the app, but disable the webhook sink endpoint so
  // future events don't fail against a closed server.
  try {
    if (S.webhook) {
      await call('PATCH', `/organizations/${S.orgId}/webhooks/${S.webhook.id}`, {
        token: S.token,
        body: { isActive: false },
      });
    }
  } catch {
    /* best effort */
  }

  process.exitCode = failed.length ? 1 : 0;
}

main()
  .catch((err) => {
    console.error('\nSQA harness crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (S.sink?.server) S.sink.server.close();
    await prisma.$disconnect();
  });
