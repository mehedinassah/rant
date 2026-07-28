# GitHub Integration — Implementation Spec

> **Goal:** replace rant's *simulated* code/CI data with **real GitHub data**, flowing
> through the existing event bus so the ripple (CI → deploy → incident → chat →
> notifications → copilot) fires on genuine events. This is the wedge that turns
> rant from a demo into a product: one real integration, zero new product surface.

This document is the source of truth for the work. It is a sequence of tickets
(`G0`–`G10`) with concrete files, acceptance criteria, and dependencies. Build them
in order; each is independently shippable behind a feature flag.

---

## 0. Design decisions (read first)

**Use a GitHub App, not just OAuth.**
A **GitHub App** is installed on an org/account and is the right primitive for a hub:
it receives webhooks, mints short-lived per-installation tokens, and can read repos,
PRs, commits, and Actions runs. We *also* use **user OAuth** — but only to link a
GitHub identity to a rant `User` (so commit authors map correctly and "Sign in with
GitHub" works later). Split responsibilities:

| Concern | Mechanism |
|---|---|
| Read repos / PRs / commits / Actions | GitHub **App** installation token (Octokit) |
| Receive real-time changes | GitHub **App webhooks** (HMAC-signed) |
| Map GitHub users → rant users | GitHub **OAuth** (user-to-server), stored as an account link |

**Keep the ripple untouched.** Webhook handlers map GitHub payloads onto the *existing*
services/models and emit the *existing* `AppEvent`s (`commit.created`,
`pull_request.opened`, `pipeline_run.completed`). Everything downstream — incidents,
chat `#activity`, notifications, copilot — keeps working with no changes. That's the
whole point: prove the ripple on real data without rebuilding it.

**Synced records are read-only and marked.** A repo/PR/commit that came from GitHub
carries `source = GITHUB` and an `externalId`. The UI shows a GitHub badge and disables
native mutation (you don't merge a PR *in rant*; GitHub is the system of record).

**Fast ack, async process.** The webhook endpoint verifies the signature, dedupes by
delivery ID, enqueues a BullMQ job, and returns `200` in <50ms. All mapping happens in
a worker (retryable, idempotent). GitHub retries failed deliveries — handlers **must**
be idempotent (upsert by `externalId`).

**Secrets.** App private key, webhook secret, and OAuth client secret come from env
(dev) / a secrets manager (prod) — never the DB in plaintext. Installation tokens are
cached in memory/Redis (they expire hourly) or stored **encrypted** at rest.

---

## G0 — GitHub App registration & config (no code) · ~0.5d

**Do:** Register a GitHub App (Settings → Developer settings → GitHub Apps).
- Permissions (read-only): Contents, Metadata, Pull requests, Checks, Actions, Members.
- Subscribe to events: `push`, `pull_request`, `pull_request_review`, `workflow_run`,
  `check_run`, `installation`, `installation_repositories`.
- Callback URL: `${WEB_URL}/settings/github/callback`; Webhook URL:
  `${API_URL}/api/v1/integrations/github/webhook`; set a webhook secret.
- Generate a private key (`.pem`).

**Add env vars** (`.env` + `.env.example`, documented in README):
```
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=        # base64-encoded PEM
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_SLUG=               # for building the install URL
```

**Acceptance:** app exists; `install` URL renders; env documented. No app code yet.

---

## G1 — Schema: provenance + link tables · ~0.5d
**Depends:** G0

**Do:** Extend `packages/database/prisma/schema.prisma`.

1. New enum:
   ```prisma
   enum RecordSource { NATIVE  GITHUB }
   ```
2. Add to `Repository`, `Commit`, `PullRequest`, `Review`, `PipelineRun`:
   ```prisma
   source     RecordSource @default(NATIVE)
   externalId String?      // GitHub node/id, stable across renames
   ```
   Add `@@unique([repositoryId, externalId])` where a repo scope exists (Commit, PR,
   Review, PipelineRun) and `@@unique([organizationId, externalId])` on Repository.
3. New models:
   ```prisma
   model GithubInstallation {
     id             String   @id @default(cuid())
     organizationId String   @unique
     installationId BigInt   @unique      // GitHub's numeric installation id
     accountLogin   String                // org/user the app is installed on
     suspendedAt    DateTime?
     createdAt      DateTime @default(now())
     updatedAt      DateTime @updatedAt
     organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
     @@map("github_installations")
   }

   model GithubAccountLink {
     id         String @id @default(cuid())
     userId     String @unique
     githubId   BigInt @unique
     login      String
     avatarUrl  String?
     createdAt  DateTime @default(now())
     user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@map("github_account_links")
   }

   model GithubWebhookDelivery {   // idempotency ledger
     id         String   @id @default(cuid())
     deliveryId String   @unique   // X-GitHub-Delivery header
     event      String
     receivedAt DateTime @default(now())
     @@map("github_webhook_deliveries")
   }
   ```
4. Back-relations on `Organization` (`githubInstallation`) and `User`
   (`githubAccountLink`).

**Acceptance:** `pnpm --filter @rant/database build` + `push` succeed; existing rows
default to `source = NATIVE`; no data loss. (Windows: kill node before generate/push.)

---

## G2 — GitHub client + auth service (Octokit) · ~1d
**Depends:** G1

**Do:** `apps/api/src/modules/integrations/github/github-auth.service.ts`
- Wrap `@octokit/app` / `@octokit/rest`.
- `appJwt()` — sign a short-lived JWT from the App ID + private key.
- `installationOctokit(installationId)` — mint & **cache** an installation token
  (Redis, TTL ~55m) and return an authed Octokit.
- `exchangeOAuthCode(code)` — user OAuth code → `{ githubId, login, avatarUrl }`.

Add deps: `@octokit/app`, `@octokit/rest`, `@octokit/auth-app`, `@octokit/webhooks-methods`.

**Acceptance:** unit test signs a JWT and (with a mocked token endpoint) returns an
Octokit; token caching verified. No network in tests.

---

## G3 — Webhook endpoint: verify → dedupe → enqueue · ~1d
**Depends:** G2

**Do:**
- `github.controller.ts` → `@Public() @Post('integrations/github/webhook')`.
  - Read raw body (configure a raw-body parser for this route in `main.ts`).
  - Verify `X-Hub-Signature-256` (HMAC-SHA256 with `GITHUB_WEBHOOK_SECRET`) using
    `@octokit/webhooks-methods` `verify()`. Reject `401` on mismatch.
  - Dedupe on `X-GitHub-Delivery` via `GithubWebhookDelivery` (unique insert; if it
    exists, ack `200` and stop).
  - Enqueue `{ event, deliveryId, payload }` to a new BullMQ queue `github-events`.
  - Return `200` immediately.
- Register a `ThrottlerGuard` skip / higher limit for this route (GitHub bursts).

**Acceptance:** a signed sample `ping`/`push` payload (fixture) returns `200` and lands
one job; a tampered signature returns `401`; a duplicate delivery id is a no-op `200`.

---

## G4 — Event processor + payload→model mappers · ~2–3d (core)
**Depends:** G3

**Do:** `github.processor.ts` (`@Processor('github-events')`) dispatching by `event`.
Each handler is **idempotent** (upsert by `externalId`) and reuses existing services
where possible, then emits the existing bus events.

| GitHub event | Maps to | Emits |
|---|---|---|
| `installation` / `installation_repositories` | create/suspend `GithubInstallation`; import repos (→ G5) | — |
| `push` | upsert `Commit`(s) `source=GITHUB` under the repo/branch | `AppEvent.CommitCreated` |
| `pull_request` (opened/…/closed/merged) | upsert `PullRequest` (map state → `PullRequestStatus`, set `mergedAt`/`mergedById`) | `AppEvent.PullRequestOpened` on open |
| `pull_request_review` | upsert `Review` (map → `ReviewState`) | — |
| `workflow_run` (completed) | upsert `Pipeline` (by workflow) + `PipelineRun` (map conclusion → `RunStatus`) | `AppEvent.PipelineRunCompleted` |
| `check_run` | optional finer-grained run status | — |

**User mapping:** resolve GitHub author → rant `User` via `GithubAccountLink`; if
unmapped, attribute to a per-org **"GitHub" ghost user** (create once) so FKs hold.
Centralize in `github-user.mapper.ts`.

**Payload mapping** lives in pure functions (`github.mappers.ts`) so they're unit-testable
without a DB: `toCommit(payload)`, `toPullRequestStatus(action, merged)`, `toRunStatus(conclusion)`.

**Acceptance (the money test):** feed a recorded `workflow_run.completed` **failed**
fixture through the processor → a `PipelineRun` row appears with `status=FAILED` **and**
`PipelineRunCompleted` fires **and** (unchanged downstream) an incident opens + a
`#activity` chat message posts + notifications are created. This proves the ripple on
real GitHub data. Cover mappers with unit tests; cover one end-to-end ripple with an
integration test.

---

## G5 — Backfill sync on install · ~1.5d
**Depends:** G4

**Do:** `github-sync.service.ts` — when an installation is created (or on manual
"Sync now"):
- List installation repos → upsert `Repository` (`source=GITHUB`, link to org).
- For each selected repo: pull recent commits (default branch), open PRs, and last N
  `workflow_run`s → upsert via the same mappers as G4.
- Paginate; respect rate limits (Octokit throttling plugin); run as a BullMQ job so a
  large org doesn't block the request.
- Store a `syncedAt` cursor to make re-syncs incremental.

**Acceptance:** installing on a test org imports its repos + open PRs; re-running is a
no-op (idempotent); rate-limit backoff observed in logs.

---

## G6 — Connect/OAuth flow + user linking · ~1d
**Depends:** G2

**Do:**
- `GET /integrations/github/install-url` → returns the App install URL (with `state`).
- `GET /integrations/github/callback` (setup redirect) → record installation, kick G5.
- `GET /integrations/github/oauth/url` + `/oauth/callback` → `exchangeOAuthCode` →
  upsert `GithubAccountLink` for the current user.
- Audit every step (`integration.github.connected`, `.user_linked`, `.uninstalled`).

**Acceptance:** an ADMIN/OWNER can connect an org; a user can link their GitHub account;
uninstall webhook flips `suspendedAt` and stops sync.

---

## G7 — Frontend: connect + synced views · ~1.5d
**Depends:** G6, G5

**Do:**
- **Settings/API page:** a "GitHub" card — Connect button, installation status, "Sync
  now", "Link my GitHub account", disconnect.
- **Repos list & detail:** show a GitHub badge on `source=GITHUB` repos; disable native
  "merge/create commit" actions for synced entities; deep-link out to github.com.
- `apps/web/src/lib/api.ts`: `github` endpoint group (installUrl, status, sync, oauth).

**Acceptance:** clicking Connect completes the install round-trip and the org's real
repos appear; synced PRs render read-only with a working GitHub link.

---

## G8 — Security & tenancy hardening · ~1d
**Depends:** G4

**Do:**
- Only ADMIN/OWNER may connect/disconnect (RolesGuard).
- Verify every webhook's `installation.id` maps to a known org before writing; drop
  events for unknown/suspended installations (prevents spoofed cross-tenant writes).
- Confirm all new queries are org-scoped (no `externalId` lookups without an org/repo
  filter) — cross-tenant leak check.
- Encrypt stored tokens (if persisting) with a KMS/`libsodium` sealed box.
- Redact secrets from logs.

**Acceptance:** a webhook for an installation not linked to any org is dropped + logged;
a non-admin gets `403` on connect; security-review skill run clean on the diff.

---

## G9 — Tests, docs, observability · ~1d
**Depends:** G4–G8

**Do:**
- Unit: mappers (status/user/commit), signature verify, token cache.
- Integration: webhook→processor→ripple (the G4 money test) wired into CI.
- Add fixtures under `__fixtures__/github/*.json` (real recorded payloads, secrets
  scrubbed).
- README + this doc: setup steps, env, "what's real vs simulated now."
- Metrics/logs: webhook received/verified/failed, job duration, rate-limit hits
  (OpenTelemetry spans if present).

**Acceptance:** `pnpm test` green including the new suites; CI runs them; docs let a new
dev connect a test org from scratch.

---

## G10 — Feature flag & rollout · ~0.5d
**Depends:** all

**Do:** gate the whole integration behind `FEATURE_GITHUB` (env / per-org flag). Ship
dark, enable for your own org first, then a design-partner org, then general.

**Acceptance:** with the flag off, zero behavior change; on, the org sees GitHub.

---

## Sequence & estimate

```
G0 → G1 → G2 → G3 → G4 ─┬─ G5 → G7
                        ├─ G6 → G7
                        └─ G8 → G9 → G10
```

**Critical path to the "money moment"** (real failed CI run → real incident/chat/notify):
**G0 → G1 → G2 → G3 → G4** ≈ **6–8 focused days**. Everything after is productionizing
and UX. Build G0–G4 first, demo the ripple on a real repo, *then* decide how far to
polish.

## Explicitly out of scope (later)
Writing back to GitHub (creating PRs/commits from rant), GitLab/Bitbucket providers
(same mapper pattern), Checks API status *from* rant, and replacing simulated deploy/
monitor modules (separate specs, same webhook-ingestion shape).
