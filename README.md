# rant

[![CI](https://github.com/mehedinassah/rant/actions/workflows/ci.yml/badge.svg)](https://github.com/mehedinassah/rant/actions/workflows/ci.yml)

**The operating system for modern software teams.**

A unified platform where companies plan, develop, deploy, monitor, and maintain
software. Not a GitHub clone. Not a Jira clone. Not a Vercel clone — a complete
software engineering ecosystem where every action ripples through the whole
system.

> Status: **all 18 modules implemented.** Auth · Organizations · Workspaces · Projects,
> a Linear-style project board (Sprints · Epics · Issues · Comments), a
> GitHub-style repository module (Repos · Branches · Commits · Tags · Releases ·
> Pull Requests · Reviews · Merge Queue), a GitHub-Actions-style CI/CD engine
> (Pipelines · Runs · Jobs · Steps · live logs), Vercel-style Deployments
> (Environments · deployments · preview URLs · rollback), Datadog-style
> Monitoring (Monitors · time-series metrics · live charts · auto-incidents),
> a cross-cutting Notification center (per-user feed · live bell · delivery
> preferences), a Notion-style Documentation base (nested pages · Markdown ·
> full version history), unified Search (one box across issues, projects,
> repos, PRs, docs and incidents), an API Platform (programmatic API keys ·
> OpenAPI docs · outbound webhooks), an Analytics dashboard (deploy
> frequency · CI pass rate · MTTR · issue throughput across every module),
> Billing (plans · subscriptions · invoices · plan-gated limits), a grounded
> AI Copilot (a chat assistant that answers from your live data and cites the
> records), Files (real multipart upload/download, attachable to any entity),
> and Team Chat (channels + an activity feed the platform posts into itself) —
> all implemented end-to-end with RBAC + audit logging, and with frontends for
> the board, repos, CI runs, deployments, monitoring, notifications, docs,
> search, API settings, analytics, billing, copilot, files and chat. This is
> where the platform *connects*: a commit triggers a CI
> run, a green run gates the PR merge **and** auto-deploys (production on the
> default branch, a preview URL per pull request), the live URL is then
> continuously health-checked, a sustained outage **auto-opens an incident,
> files a bug on the linked project, drafts a postmortem page** in that
> workspace's docs, **fans out as a notification** to the right people, **posts to
> the team's activity channel**, and **fires a signed webhook** to external
> systems — the whole loop from an idea to a live URL to an observed outage to
> everyone (and everything) that needs to know, inside one system.

---

## Architecture

A pnpm + Turborepo monorepo:

```
rant/
├── apps/
│   ├── api/        # NestJS backend — layered modules, JWT auth, RBAC guards
│   └── web/        # Next.js 15 (App Router) frontend
├── packages/
│   └── database/   # Prisma schema + generated client (@rant/database)
├── docker-compose.yml   # Postgres 16 + Redis 7 for local dev
└── turbo.json
```

**Backend flow:** `Controller → Service → PrismaService → PostgreSQL`, with
global `JwtAuthGuard` (opt out via `@Public()`) and a global `RolesGuard` that
resolves org membership from the `:orgId` route param and enforces `@Roles(...)`.
Every meaningful mutation writes to an immutable `audit_logs` table.

Modules stay decoupled through an internal **event bus** (`@nestjs/event-emitter`):
one module emits a domain event (`commit.created`, `pull_request.opened`,
`pipeline_run.completed`, `deployment.completed`, `incident.opened`) and others
react without importing each other. CI/CD and Deployments push work onto
**BullMQ queues** (Redis), where background workers execute pipeline runs and
deployments step-by-step and stream progress to clients over **Server-Sent
Events**. Monitoring adds a periodic scheduler that probes every live
deployment, records time-series health, and opens/resolves incidents — a
critical incident even ripples *back* into project management by filing a bug
issue. **Notifications** is the pure consumer at the end of the bus: it
subscribes to CI, deploy, incident and pull-request events and fans each one out
to the right people's feed (respecting per-category delivery preferences). The
**API Platform** re-broadcasts those same events as HMAC-signed outbound
webhooks, and **Team Chat** posts them as system messages into the org's
activity channel — so the ripple reaches external systems *and* the team's
conversation. A commit → a CI run → a
deployment → a monitored URL → an incident → a bug → a notification → a webhook
is one chain of events, each hop reacting to the last.

## Tech stack

Next.js 15 · NestJS 10 · Prisma 6 · PostgreSQL · Redis · BullMQ (queue + worker) ·
Server-Sent Events · in-process scheduler · OpenAPI/Swagger · Turborepo · pnpm ·
TypeScript · argon2 · JWT (access + rotating refresh tokens) · API keys +
HMAC-signed webhooks.

## Prerequisites

- Node.js ≥ 20 (tested on 22)
- pnpm (`npm i -g pnpm`)
- **Postgres 16 + Redis** — easiest via Docker: `docker compose up -d`
  (or point `DATABASE_URL` at any Postgres instance, e.g. Neon/Supabase).

## Getting started

```bash
# 1. install
pnpm install

# 2. env
cp .env.example .env      # then edit secrets if you like

# 3. database (needs Postgres running)
docker compose up -d      # starts postgres + redis
pnpm db:push              # sync schema
pnpm db:seed              # demo org/workspace/project

# 4. run everything (api + web + db watcher)
pnpm dev
```

- API → http://localhost:4000/api/v1 (health: `/api/v1/health`)
- API docs (OpenAPI/Swagger) → http://localhost:4000/docs
- Web → http://localhost:3000

## Useful scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Run all apps in watch mode (Turborepo)       |
| `pnpm build`        | Build every package/app                      |
| `pnpm typecheck`    | Typecheck the whole repo                     |
| `pnpm test`         | Run the unit test suite                      |
| `pnpm db:push`      | Push Prisma schema to the database           |
| `pnpm db:migrate`   | Create + apply a migration                   |
| `pnpm db:seed`      | Seed demo data                               |
| `pnpm db:studio`    | Open Prisma Studio                           |

## Testing & CI

The API ships a Jest unit suite for its pure logic (`pnpm test`) — API-key
hashing, pagination clamping, the CI/deploy simulation predicates, and the
copilot's intent classifier. A **GitHub Actions** workflow
(`.github/workflows/ci.yml`) runs `install → prisma generate → typecheck → test →
build` on every push and pull request. Each module was additionally verified
end-to-end during development with throwaway smoke scripts against a live server.

The API is hardened with **helmet** (security headers) and **rate limiting**
(`@nestjs/throttler`: 120 req/min per IP, 10/min on auth), and list endpoints
that can grow (the audit log) are **paginated**.

## API surface

Base URL: `/api/v1`

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` ·
`POST /auth/logout` · `GET /auth/me`

**Organizations** — `GET|POST /organizations` ·
`GET|PATCH|DELETE /organizations/:orgId` ·
`GET|POST /organizations/:orgId/members` ·
`PATCH|DELETE /organizations/:orgId/members/:userId`

**Workspaces** — `GET|POST /organizations/:orgId/workspaces` ·
`GET|PATCH|DELETE /organizations/:orgId/workspaces/:workspaceId`

**Projects** —
`GET|POST /organizations/:orgId/workspaces/:workspaceId/projects` ·
`GET|PATCH|DELETE .../projects/:projectId`

**Sprints** — `GET|POST .../projects/:projectId/sprints` ·
`GET|PATCH|DELETE .../sprints/:sprintId`

**Epics** — `GET|POST .../projects/:projectId/epics` ·
`GET|PATCH|DELETE .../epics/:epicId`

**Issues** — `GET|POST .../projects/:projectId/issues`
(filterable by `status`, `type`, `sprintId`, `epicId`, `assigneeId`) ·
`GET|PATCH|DELETE .../issues/:issueId` · atomic per-project numbering
(`RANT-123`), subtasks, story points

**Comments** — `GET|POST .../issues/:issueId/comments` ·
`DELETE .../comments/:commentId` (author or MANAGER+)

**Repositories** — `GET|POST /organizations/:orgId/repositories` ·
`GET|PATCH|DELETE .../repositories/:repoId`

**Branches** — `GET|POST .../:repoId/branches` · `DELETE .../branches/:name`

**Commits** — `GET|POST .../:repoId/commits` (advances branch head) ·
`GET .../commits/:sha`

**Tags / Releases** — `GET|POST .../:repoId/tags` · `DELETE .../tags/:name` ·
`GET|POST .../:repoId/releases` · `DELETE .../releases/:releaseId`

**Pull Requests** — `GET|POST .../:repoId/pulls` · `GET|PATCH .../pulls/:number` ·
`GET|POST .../pulls/:number/reviews` · `POST .../pulls/:number/merge`
(gated on reviews — blocks if changes requested)

**Merge Queue** — `POST|DELETE .../pulls/:number/queue` (enqueue/dequeue) ·
`GET .../:repoId/merge-queue` · `POST .../merge-queue/process`

**Pipelines (CI/CD)** — `GET|POST .../:repoId/pipelines` ·
`GET|PATCH|DELETE .../pipelines/:pipelineId` ·
`POST .../pipelines/:pipelineId/run` (manual dispatch). A pipeline holds a
declarative `{ jobs: [ { name, steps: [ { name, run } ] } ] }` config and
subscribes to triggers (`PUSH`, `PULL_REQUEST`, `MANUAL`). Pushing a commit or
opening a PR auto-starts matching runs on a background worker.

**Runs** — `GET .../:repoId/runs` · `GET .../runs/:runId` (jobs + steps + logs) ·
`GET .../runs/:runId/stream` (Server-Sent Events, live) ·
`POST .../runs/:runId/cancel`. A PR's newest run must be green before it can
merge — a failing or in-flight run blocks the merge with `409`.

**Environments** — `GET|POST .../:repoId/environments` ·
`PATCH|DELETE .../environments/:envId` ·
`POST .../environments/:envId/deploy` (manual) ·
`POST .../environments/:envId/rollback`. A repo is created with a Production
environment that watches its default branch; each environment tracks the
`currentDeployment` that is live right now.

**Deployments** — `GET .../:repoId/deployments` ·
`GET .../deployments/:deploymentId` ·
`GET .../deployments/:deploymentId/stream` (Server-Sent Events, live logs) ·
`POST .../deployments/:deploymentId/cancel`. A background worker runs
BUILDING → DEPLOYING → READY and assigns a public URL. **The ripple:** a green
CI run auto-deploys — production for a push to the watched branch, a
PR-scoped preview URL for a pull request.

**Monitors** — `GET .../:repoId/monitors` (per-environment health + 30-min
rollup) · `GET .../monitors/:monitorId` · `GET .../monitors/:monitorId/metrics`
(time-series samples) · `GET .../monitors/:monitorId/stream` (Server-Sent
Events, live metrics) · `PATCH .../monitors/:monitorId` (pause/rename) ·
`POST .../monitors/:monitorId/simulate` (inject/clear an outage for demos). A
monitor is created for each environment; once a deployment is live an in-process
scheduler probes it every few seconds, recording latency/uptime.

**Incidents** — `GET .../:repoId/incidents` · `GET .../incidents/:incidentId` ·
`POST .../incidents/:incidentId/acknowledge` ·
`POST .../incidents/:incidentId/resolve`. **The ripple closes the loop:** two
consecutive failed checks auto-open an incident (CRITICAL on production) and
file a `BUG` issue on the repo's linked project; a recovered check auto-resolves
the incident and closes that issue.

**Notifications** (user-scoped, no `:orgId`) — `GET /notifications`
(`?unread=true`) · `GET /notifications/unread-count` ·
`GET /notifications/stream` (Server-Sent Events, live bell) ·
`POST /notifications/:id/read` · `POST /notifications/read-all` ·
`DELETE /notifications/:id` · `GET|PUT /notifications/preferences`. A pure
consumer of the event bus: a failed CI run, a deploy, an opened/resolved
incident and a new pull request each fan out to the relevant members' feed
(by org role), respecting per-category in-app/email preferences. Email is a
logged stub until a real provider is wired up.

**Documentation** — `GET|POST .../workspaces/:workspaceId/docs` (page tree) ·
`GET|PATCH|DELETE .../docs/:docId` · `GET .../docs/:docId/revisions` ·
`GET .../docs/:docId/revisions/:revisionId` ·
`POST .../docs/:docId/revisions/:revisionId/restore`. A workspace knowledge base
of nested Markdown pages; every edit snapshots an immutable revision (restore is
itself reversible). Also a bus consumer — a CRITICAL incident auto-drafts a
templated postmortem page in the affected repo's workspace.

**Search** — `GET .../search?q=&types=&limit=` (unified, org-scoped search across
issues, projects, repositories, pull requests, docs and incidents; results
grouped by type with matched-text snippets and a frontend deep-link each) ·
`GET|POST .../search/saved` · `DELETE .../search/saved/:id` (per-user pinned
queries). The payoff of one connected system — a single box finds anything, and
every result jumps straight to the module that owns it.

**Analytics** — `GET .../analytics/overview?days=` (org-wide rollup computed live
across every module: totals, issue throughput + status mix, deployment frequency
+ success rate, CI pass rate, incident count + MTTR, monitor uptime, and the
most-deployed repos). No new storage — it aggregates the data the other modules
already produce.

**Team Chat** — `GET|POST .../channels` · `GET|POST .../channels/:id/messages` ·
`GET .../channels/:id/stream` (Server-Sent Events, live thread). Each org gets a
`#general` channel and a system `#activity` channel; the **integration layer**
posts SYSTEM messages into `#activity` whenever a deploy, incident, CI failure
or pull request fires — the event bus flowing straight into the conversation.

**Files** — `POST .../files` (multipart upload, field `file`, optional
`targetType`/`targetId` to attach) · `GET .../files` (list, filterable by
target) · `GET .../files/:fileId` · `GET .../files/:fileId/download` (streams the
bytes with the right content-type) · `DELETE .../files/:fileId`. There's no real
S3 — bytes live in the database (5 MB cap) behind a synthetic CDN URL — but
uploads and downloads genuinely round-trip, and a file can attach to any entity.

**Copilot** — `POST .../copilot/ask` (message + optional conversationId) ·
`GET .../copilot/conversations` · `GET|DELETE .../copilot/conversations/:id` ·
`GET .../copilot/suggestions`. A **grounded** assistant: it classifies intent
and answers from live org data — “what’s broken?” lists open incidents, down
monitors and recent CI/deploy failures; “what shipped this week?” counts
deployments, merged PRs and completed issues; “what should I work on?” returns
your open issues by priority; “give me a summary” snapshots the org. Every
answer **cites the exact records** with deep-links, and conversations are saved.
(No external LLM — the reasoning is deterministic and data-backed.)

**Billing** — `GET .../billing/plans` · `GET .../billing/subscription` ·
`GET .../billing/usage` · `GET .../billing/invoices` ·
`POST .../billing/subscription` (change plan) ·
`POST .../billing/subscription/cancel|resume`. Every org has a subscription
(FREE by default) whose plan **gates how many members / repositories / projects
it can create** — exceeding the limit returns a `403` with an upgrade prompt,
enforced right in those create paths. Changing to a paid plan mints a simulated
invoice. No real payment processor; the money is make-believe, the enforcement
is real.

**API Platform** — `GET|POST .../api-keys` · `DELETE .../api-keys/:keyId`
(programmatic keys; the raw secret is shown once, stored only as a SHA-256 hash).
A key authenticates via `X-API-Key:` or `Authorization: Bearer rant_…` and acts
as its creating user, so all RBAC applies. `GET|POST .../webhooks` ·
`PATCH|DELETE .../webhooks/:id` · `GET .../webhooks/:id/deliveries` ·
`GET .../webhook-events` — subscribe an endpoint to bus events and receive
HMAC-signed (`X-Rant-Signature`) POSTs, with every attempt logged. Interactive
**OpenAPI docs** are served at `/docs`.

## Roles (RBAC)

`OWNER · ADMIN · MANAGER · DEVELOPER · QA · DEVOPS · VIEWER · GUEST`

`OWNER` and `ADMIN` may perform any org-scoped action; other roles are granted
per-route via `@Roles(...)`.

## Roadmap

All 18 modules from the system design are implemented, plus a first hardening
pass: **security headers + rate limiting**, an **Audit UI** with **pagination**,
and a **unit test suite wired into GitHub Actions CI**.

What remains is deeper production-hardening rather than new surface area:
swapping the simulated workers for real runners/hosts (containers, a real host,
a git backend), broader test coverage (integration + e2e), member-invite emails
via a real provider, object storage (S3/R2) in place of in-database bytes,
WebSockets for richer real-time, and OpenTelemetry for observing rant itself.
