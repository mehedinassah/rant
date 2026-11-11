# Deploy & Monitor Integrations — Vercel + Sentry

> **Goal:** extend the GitHub pattern to the other two halves of the loop —
> shipping and observing. A real Vercel deployment becomes a rant `Deployment`
> and retargets monitoring; a real Sentry issue becomes a rant `Incident` and
> drives the same postmortem/chat/notification/webhook ripple. No new product
> surface: the modules, models and events already exist.

This is the design + setup guide. It mirrors [`github-integration.md`](github-integration.md):
**verify webhook → dedupe by delivery → enqueue → map in a worker → emit the
existing domain event.**

---

## 1. Design decisions

**One generic link table, one ledger.** Vercel and Sentry both need to map an
external project to a rant repository, and both need webhook idempotency. Rather
than duplicating provider-specific tables, the schema adds:

- `IntegrationProvider` enum (`VERCEL`, `SENTRY`)
- `IntegrationProjectLink` — `(provider, externalProjectId) → repository`
  (+ optional environment override)
- `IntegrationWebhookDelivery` — `(provider, deliveryId)` unique ledger,
  annotated with the provider project id so each org can read only its own
  delivery log

Adding a third provider is a new enum value plus a mapper — not a migration.
A provider project can be linked by exactly one org: a second org attempting to
re-point it gets `409`, so webhooks can never be redirected cross-tenant.

**Provenance is explicit.** `Deployment` and `Incident` gain
`source: RecordSource` (`VERCEL` / `SENTRY`) and `externalId`, with
`@@unique([environmentId, externalId])` / `@@unique([monitorId, externalId])`,
so redelivered or replayed webhooks are idempotent upserts.

**Sentry owns its incidents.** The simulated prober only auto-resolves incidents
with `source = NATIVE`, so a Sentry incident stays open until Sentry says it is
resolved — the two lifecycles never fight.

**Fast ack, async work.** The public endpoint verifies the signature, claims the
delivery id, enqueues a BullMQ job and returns immediately. Mapping happens in a
worker with retries, so provider timeouts are irrelevant.

---

## 2. Vercel (deployments)

| Concern | Value |
|---|---|
| Endpoint | `POST /api/v1/integrations/vercel/webhook` (public) |
| Signature | `x-vercel-signature` — HMAC-SHA1 (or SHA-256) hex of the raw body |
| Delivery id | `x-vercel-id`, else SHA-256 of the body |
| Queue | `vercel-events` |

| Vercel event | Deployment state |
|---|---|
| `deployment.created` / `deployment.building` | `BUILDING` |
| `deployment.ready` / `deployment.succeeded` | `READY` |
| `deployment.error` | `FAILED` |
| `deployment.canceled` | `CANCELLED` |

The worker resolves the link by Vercel project id, picks the linked environment
(or the repo's `Production`), upserts the `Deployment` by `externalId`, sets
`environment.currentDeploymentId` only for `READY`, then emits
`deployment.completed`. Downstream is unchanged:

- `MonitoringListeners` retargets the environment's monitor at the real URL.
- The notification, `#activity` chat, signed-webhook and Socket.IO bridges fire.
- A commit SHA / branch / PR id from `deployment.meta` is preserved on the record.

**Setup**

1. Vercel → Project → Settings → Webhooks → create one for
   `https://<api>/api/v1/integrations/vercel/webhook`, selecting deployment
   events, and copy the signing secret.
2. Set `VERCEL_WEBHOOK_SECRET` (and optionally `FEATURE_VERCEL`, `VERCEL_TEAM_ID`).
3. In rant → Integrations → Vercel, link the Vercel project id (`prj_…`) to a
   repository.

---

## 3. Sentry (incidents)

| Concern | Value |
|---|---|
| Endpoint | `POST /api/v1/integrations/sentry/webhook` (public) |
| Signature | `sentry-hook-signature` — HMAC-SHA256 hex of the raw body, keyed by the Client Secret |
| Delivery id | `request-id`, else SHA-256 of the body |
| Queue | `sentry-events` |

Only `resource: issue` deliveries are modeled:

| Sentry action | Incident |
|---|---|
| `created` / `unresolved` | open (or reopen) |
| `resolved` | resolve + close the linked bug issue |
| `assigned` / `ignored` | ignored |

| Sentry level | Severity |
|---|---|
| `fatal` | `CRITICAL` |
| `error` | `MAJOR` |
| `warning` / `info` / `debug` | `MINOR` |

Opening an issue creates/reuses the environment's monitor, files a `BUG` issue
on the repo's linked project, emits `incident.opened`, and (for `CRITICAL`)
drafts the postmortem doc — exactly the simulated scheduler's ripple.

**Setup**

1. Sentry → Settings → Developer Settings → Custom Integrations → create an
   Internal Integration with the webhook URL above; copy the Client Secret.
2. Set `SENTRY_WEBHOOK_SECRET` (or `SENTRY_CLIENT_SECRET`).
3. In rant → Integrations → Sentry, link the Sentry project id (`4500…`) to a
   repository.

---

## 4. Realtime and tracing

- **Socket.IO** (`/realtime`) complements the SSE streams. The handshake carries
  the JWT; org/channel rooms are joined only after an active-membership check.
  Domain events and persisted notifications are republished by a bridge, so a
  deploy lands in an open dashboard instantly.
- **OpenTelemetry** is opt-in (`OTEL_ENABLED=true`). Instrumentation is installed
  before Nest bootstraps, and a Nest interceptor adds one span per handler.

---

## 5. Testing

- Pure mapping: `vercel.mappers.spec.ts`, `sentry.mappers.spec.ts`.
- Signature + dedupe: `*-webhook.service.spec.ts`.
- Fixtures through the workers: `*-processor.spec.ts`.
- End-to-end (`pnpm test:e2e`, real Postgres + Redis): a signed Vercel webhook
  creates a `READY` deployment and retargets the monitor; a signed Sentry issue
  creates an incident, bug issue, notification and chat post, then resolves; a
  Socket.IO subscriber receives `incident.opened`; a `CRITICAL` issue drafts a
  postmortem doc.

---

## 6. What is real vs simulated now

| Module | Real integration | Simulated default |
|---|---|---|
| Repos / CI / PRs | GitHub App + webhooks | native records |
| Deployments | **Vercel webhooks** | background worker |
| Monitoring / incidents | **Sentry webhooks** | periodic prober |
| Billing | Stripe | simulated provider |

The demo still works with zero credentials: every integration is gated behind
its `FEATURE_*` flag and defaults off until configured.
