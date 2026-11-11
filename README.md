# rant

[![CI](https://github.com/mehedinassah/rant/actions/workflows/ci.yml/badge.svg)](https://github.com/mehedinassah/rant/actions/workflows/ci.yml)

**The incident-to-fix workspace for modern software teams.**

Rant turns a production alert into a linked incident, bug, postmortem, and shipped fix — with one unified audit trail across GitHub, Vercel, Sentry, and your team's chat. 

While the long-term vision is to be the complete "Operating System for Modern Software Teams," our first measurable promise is narrower: **less time from "it's broken" to "it's fixed, and we learned something."**

## 🧠 The Core Idea: The Event Graph

Rant is not a collection of disconnected tools. The platform is built around a single event graph where every action ripples through the system:

`commit → CI → deploy → monitor → incident → bug → postmortem → notification → chat → signed webhook`

Most tools own one box (Jira owns issues, GitHub owns code, Datadog owns monitoring). Rant makes the boxes talk to each other. A commit triggers a CI run, a green run gates the PR merge **and** auto-deploys. The live URL is continuously health-checked. A sustained outage **auto-opens an incident, files a bug, drafts a postmortem, fans out notifications, posts to the team's activity channel, and fires a signed webhook**. 

---

## ⚠️ Current Status: High-Fidelity MVP

We believe in total transparency. Rant is currently a **strong internal MVP / high-fidelity demo**, not yet a production SaaS. 

**What is actually built:**
- **Scale:** ~20,000 lines of TypeScript across 240 source files.
- **Surface:** 18+ modules, 179 HTTP routes, 49 Prisma models, 6 migrations.
- **The "Ripple" is Real:** Incident → Bug → Postmortem → Chat → Webhook flows are fully functional and SQA-tested against real Postgres/Redis.
- **Real Integrations:** GitHub (App + webhooks), Vercel (deployments), and Sentry (incidents). All are signature-verified, deduped, and idempotent.
- **All 18 Modules Implemented:** Auth, Orgs, Workspaces, Projects (Linear-style), Repos (GitHub-style), CI/CD (Actions-style), Deployments (Vercel-style), Monitoring (Datadog-style), Notifications, Docs (Notion-style), Search, API Platform, Analytics, Billing, AI Copilot, Files, and Team Chat.

**What is currently simulated:**
- CI pipelines, deployments, and health monitor probes are simulated (unless driven by real external webhooks). The platform records engineering rather than executing real code builds.
- Billing, email delivery, and object storage are provider-abstracted stubs (ready for Stripe, Resend, and S3).

**Pre-Production Hardening (Blockers):**
- Migrating JWT tokens from `localStorage` to HttpOnly cookies (CSRF protection).
- Fixing webhook SSRF vulnerabilities via DNS/IP allowlisting.
- Adding SSO/SAML, email verification, and MFA.
- Implementing Postgres RLS (Row Level Security) for hard tenant isolation.

---

## 🏗️ Architecture & Tech Stack

A pnpm + Turborepo monorepo:

```text
rant/
├── apps/
│   ├── api/        # NestJS backend — layered modules, JWT auth, RBAC guards
│   └── web/        # Next.js 15 (App Router) frontend
├── packages/
│   └── database/   # Prisma schema + generated client (@rant/database)
├── docker-compose.yml   # Postgres 16 + Redis 7 for local dev
└── turbo.json
Backend flow: Controller → Service → PrismaService → PostgreSQL, with global JwtAuthGuard and RolesGuard. Every meaningful mutation writes to an immutable audit_logs table.

Event Bus & Queues: Modules stay decoupled through an internal event bus (@nestjs/event-emitter). CI/CD and Deployments push work onto BullMQ queues (Redis), where background workers execute tasks and stream progress to clients over Server-Sent Events (SSE).

Real-time & Observability: A JWT-authenticated Socket.IO gateway pushes the event bus to connected UIs. OpenTelemetry tracing is one env var away.

Tech Stack: Next.js 15 · NestJS 10 · Prisma 6 · PostgreSQL · Redis · BullMQ · Socket.IO · OpenAPI/Swagger · TypeScript · argon2 · JWT (access + rotating refresh) · HMAC-signed webhooks.

🛠️ Getting Started (Local Development)
Prerequisites: Node.js ≥ 20, pnpm, and Postgres 16 + Redis (easiest via Docker).

bash
# 1. Install
pnpm install

# 2. Env
cp .env.example .env      # then edit secrets if you like

# 3. Database (needs Docker running)
docker compose up -d      # starts postgres + redis
pnpm db:migrate:deploy    # apply migrations
pnpm db:seed              # demo org/workspace/project

# 4. Run everything
pnpm dev
Web: http://localhost:3000

API: http://localhost:4000/api/v1 (health: /api/v1/health)

Swagger Docs: http://localhost:4000/docs

Testing & SQA
We take quality seriously. The repo ships with:

Unit tests (pnpm test): Pure logic, signature verification, dedupe.

E2E tests (pnpm test:e2e): Real Postgres/Redis, supertest HTTP driving, RBAC isolation, Socket.IO.

SQA API (pnpm sqa): 92 black-box checks against a running stack.

SQA UI (pnpm sqa:ui): Headless browser driving the real login/UI, capturing screenshots.

(The latest run and defect log live in docs/sqa-report.md).

🗺️ Roadmap to Production
Phase 1: Pilot-Ready (3–4 weeks)

□ Implement HttpOnly cookie sessions (CSRF protection).
□ Add email verification and password reset.
□ Fix webhook SSRF vulnerabilities.
□ Add Redis Socket.IO adapter for multi-instance real-time.
□ Setup BullMQ Dead Letter Queues (DLQ) and graceful shutdown.
□ Add backup/PITR drills and Sentry error tracking for Rant itself.
Phase 2: Public SaaS (3–6 months)

□ Postgres RLS and formal multi-tenant isolation tests.
□ External penetration testing and SOC2 readiness.
□ Real CI/CD execution (actual builds, not simulations).
□ Onboarding flows, importers (Jira/GitHub), and live Stripe billing.
Phase 3: Depth & AI

□ Provider backfill (listing Vercel/Sentry projects via APIs).
□ LLM-powered Copilot over your team's incident data.
□ Advanced DORA metrics and engineering analytics.
<details> <summary><b>📚 Click to view the full API Surface (179 Routes)</b></summary>
Base URL: /api/v1

Auth — POST /auth/register · POST /auth/login · POST /auth/refresh · POST /auth/logout · GET /auth/me

Organizations — GET|POST /organizations · GET|PATCH|DELETE /organizations/:orgId · GET|POST /organizations/:orgId/members · PATCH|DELETE /organizations/:orgId/members/:userId

Invitations — GET|POST /organizations/:orgId/invitations · DELETE /organizations/:orgId/invitations/:invitationId · GET /invitations/:token (public preview) · POST /invitations/:token/accept.

GitHub integration — POST /integrations/github/webhook (public, HMAC-signed) · GET|POST|DELETE /organizations/:orgId/integrations/github[/…] (install-url, complete-install, status, resync, disconnect — ADMIN) · GET|POST|DELETE /integrations/github/account. See the design spec.

Vercel integration — POST /integrations/vercel/webhook (public, HMAC-signed) · GET /organizations/:orgId/integrations/vercel/status|links|deliveries · POST|DELETE /organizations/:orgId/integrations/vercel/links[/:linkId] (ADMIN). See the deploy-monitor spec.

Sentry integration — POST /integrations/sentry/webhook (public, HMAC-signed) · GET /organizations/:orgId/integrations/sentry/status|links|deliveries · POST|DELETE /organizations/:orgId/integrations/sentry/links[/:linkId] (ADMIN).

Workspaces — GET|POST /organizations/:orgId/workspaces · GET|PATCH|DELETE /organizations/:orgId/workspaces/:workspaceId

Projects — GET|POST /organizations/:orgId/workspaces/:workspaceId/projects · GET|PATCH|DELETE .../projects/:projectId

Sprints — GET|POST .../projects/:projectId/sprints · GET|PATCH|DELETE .../sprints/:sprintId

Epics — GET|POST .../projects/:projectId/epics · GET|PATCH|DELETE .../epics/:epicId

Issues — GET|POST .../projects/:projectId/issues (filterable by status, type, sprintId, epicId, assigneeId) · GET|PATCH|DELETE .../issues/:issueId · atomic per-project numbering (RANT-123), subtasks, story points.

Comments — GET|POST .../issues/:issueId/comments · DELETE .../comments/:commentId (author or MANAGER+)

Repositories — GET|POST /organizations/:orgId/repositories · GET|PATCH|DELETE .../repositories/:repoId

Branches — GET|POST .../:repoId/branches · DELETE .../branches/:name

Commits — GET|POST .../:repoId/commits (advances branch head) · GET .../commits/:sha

Tags / Releases — GET|POST .../:repoId/tags · DELETE .../tags/:name · GET|POST .../:repoId/releases · DELETE .../releases/:releaseId

Pull Requests — GET|POST .../:repoId/pulls · GET|PATCH .../pulls/:number · GET|POST .../pulls/:number/reviews · POST .../pulls/:number/merge (gated on reviews — blocks if changes requested)

Merge Queue — POST|DELETE .../pulls/:number/queue (enqueue/dequeue) · GET .../:repoId/merge-queue · POST .../merge-queue/process

Pipelines (CI/CD) — GET|POST .../:repoId/pipelines · GET|PATCH|DELETE .../pipelines/:pipelineId · POST .../pipelines/:pipelineId/run (manual dispatch).

Runs — GET .../:repoId/runs · GET .../runs/:runId (jobs + steps + logs) · GET .../runs/:runId/stream (Server-Sent Events, live) · POST .../runs/:runId/cancel.

Environments — GET|POST .../:repoId/environments · PATCH|DELETE .../environments/:envId · POST .../environments/:envId/deploy (manual) · POST .../environments/:envId/rollback.

Deployments — GET .../:repoId/deployments · GET .../deployments/:deploymentId · GET .../deployments/:deploymentId/stream (Server-Sent Events, live logs) · POST .../deployments/:deploymentId/cancel.

Monitors — GET .../:repoId/monitors (per-environment health + 30-min rollup) · GET .../monitors/:monitorId · GET .../monitors/:monitorId/metrics · GET .../monitors/:monitorId/stream (SSE) · PATCH .../monitors/:monitorId · POST .../monitors/:monitorId/simulate.

Incidents — GET .../:repoId/incidents · GET .../incidents/:incidentId · POST .../incidents/:incidentId/acknowledge · POST .../incidents/:incidentId/resolve.

Notifications — GET /notifications · GET /notifications/unread-count · GET /notifications/stream (SSE) · POST /notifications/:id/read · POST /notifications/read-all · DELETE /notifications/:id · GET|PUT /notifications/preferences.

Realtime — Socket.IO namespace /realtime. Handshake carries JWT token; clients join subscribe:org / subscribe:channel rooms.

Documentation — GET|POST .../workspaces/:workspaceId/docs (page tree) · GET|PATCH|DELETE .../docs/:docId · GET .../docs/:docId/revisions · GET .../docs/:docId/revisions/:revisionId · POST .../docs/:docId/revisions/:revisionId/restore.

Search — GET .../search?q=&types=&limit= (unified, org-scoped) · GET|POST .../search/saved · DELETE .../search/saved/:id.

Analytics — GET .../analytics/overview?days= (org-wide rollup: issue throughput, deployment frequency, CI pass rate, MTTR, monitor uptime).

Team Chat — GET|POST .../channels · GET|POST .../channels/:id/messages · GET .../channels/:id/stream (SSE).

Files — POST .../files (multipart upload) · GET .../files · GET .../files/:fileId · GET .../files/:fileId/download · DELETE .../files/:fileId.

Copilot — POST .../copilot/ask · GET .../copilot/conversations · GET|DELETE .../copilot/conversations/:id · GET .../copilot/suggestions.

Billing — GET .../billing/plans · GET .../billing/subscription · GET .../billing/usage · GET .../billing/invoices · POST .../billing/subscription · POST .../billing/subscription/cancel|resume.

API Platform — GET|POST .../api-keys · DELETE .../api-keys/:keyId · GET|POST .../webhooks · PATCH|DELETE .../webhooks/:id · GET .../webhooks/:id/deliveries · GET .../webhook-events.

</details>

Built for software teams who are tired of context switching.
