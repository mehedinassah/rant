# rant

**The operating system for modern software teams.**

A unified platform where companies plan, develop, deploy, monitor, and maintain
software. Not a GitHub clone. Not a Jira clone. Not a Vercel clone — a complete
software engineering ecosystem where every action ripples through the whole
system.

> Status: **early foundation.** Auth · Organizations · Workspaces · Projects,
> a Linear-style project board (Sprints · Epics · Issues · Comments), a
> GitHub-style repository module (Repos · Branches · Commits · Tags · Releases ·
> Pull Requests · Reviews · Merge Queue), a GitHub-Actions-style CI/CD engine
> (Pipelines · Runs · Jobs · Steps · live logs), Vercel-style Deployments
> (Environments · deployments · preview URLs · rollback), and Datadog-style
> Monitoring (Monitors · time-series metrics · live charts · auto-incidents) —
> all implemented end-to-end with RBAC + audit logging, and with frontends for
> the board, repos, CI runs, deployments and monitoring. This is where the
> platform *connects*: a commit triggers a CI run, a green run gates the PR
> merge **and** auto-deploys (production on the default branch, a preview URL
> per pull request), the live URL is then continuously health-checked, and a
> sustained outage **auto-opens an incident and files a bug on the linked
> project** — the whole loop from an idea to a live URL to an observed outage
> inside one system. The remaining modules from the system design
> (Notifications, AI Copilot, Billing, …) are on the roadmap.

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
issue. A commit → a CI run → a deployment → a monitored URL → an incident → a
bug is one chain of events, each hop reacting to the last.

## Tech stack

Next.js 15 · NestJS 10 · Prisma 6 · PostgreSQL · Redis · BullMQ (queue + worker) ·
Server-Sent Events · in-process scheduler · Turborepo · pnpm · TypeScript ·
argon2 · JWT (access + rotating refresh tokens).

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
- Web → http://localhost:3000

## Useful scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Run all apps in watch mode (Turborepo)       |
| `pnpm build`        | Build every package/app                      |
| `pnpm typecheck`    | Typecheck the whole repo                     |
| `pnpm db:push`      | Push Prisma schema to the database           |
| `pnpm db:migrate`   | Create + apply a migration                   |
| `pnpm db:seed`      | Seed demo data                               |
| `pnpm db:studio`    | Open Prisma Studio                           |

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

## Roles (RBAC)

`OWNER · ADMIN · MANAGER · DEVELOPER · QA · DEVOPS · VIEWER · GUEST`

`OWNER` and `ADMIN` may perform any org-scoped action; other roles are granted
per-route via `@Roles(...)`.

## Roadmap

Notifications · Documentation · API Platform · AI Copilot · Analytics ·
Billing · Audit UI · Search · Files · Team Chat · Integrations.
