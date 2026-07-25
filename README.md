# rant

**The operating system for modern software teams.**

A unified platform where companies plan, develop, deploy, monitor, and maintain
software. Not a GitHub clone. Not a Jira clone. Not a Vercel clone — a complete
software engineering ecosystem where every action ripples through the whole
system.

> Status: **early foundation.** Auth · Organizations · Workspaces · Projects,
> a Linear-style project board (Sprints · Epics · Issues · Comments), a
> GitHub-style repository module (Repos · Branches · Commits · Tags · Releases ·
> Pull Requests · Reviews · Merge Queue), and a GitHub-Actions-style CI/CD engine
> (Pipelines · Runs · Jobs · Steps · live logs) — all implemented end-to-end with
> RBAC + audit logging. CI is where the platform starts to *connect*: a commit
> or an opened PR automatically triggers pipeline runs on a background worker,
> and a run's result feeds back into the PR merge gate. The remaining modules
> from the system design (Deployments, Monitoring, AI Copilot, Billing, …) are
> on the roadmap.

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
one module emits a domain event (`commit.created`, `pull_request.opened`) and
others react without importing each other. CI/CD listens on that bus and pushes
work onto a **BullMQ queue** (Redis), where a background worker executes pipeline
runs step-by-step and streams progress to clients over **Server-Sent Events**.

## Tech stack

Next.js 15 · NestJS 10 · Prisma 6 · PostgreSQL · Redis · BullMQ (queue + worker) ·
Server-Sent Events · Turborepo · pnpm · TypeScript · argon2 ·
JWT (access + rotating refresh tokens).

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

## Roles (RBAC)

`OWNER · ADMIN · MANAGER · DEVELOPER · QA · DEVOPS · VIEWER · GUEST`

`OWNER` and `ADMIN` may perform any org-scoped action; other roles are granted
per-route via `@Roles(...)`.

## Roadmap

Documentation · API Platform · Deployments · Monitoring ·
Notifications · AI Copilot · Analytics · Billing · Audit UI · Search · Files ·
Team Chat · Integrations.
