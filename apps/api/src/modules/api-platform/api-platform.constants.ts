/** The domain events an org can subscribe a webhook to (mirrors the internal bus). */
export const WEBHOOK_EVENTS = [
  'pull_request.opened',
  'pipeline_run.completed',
  'deployment.completed',
  'incident.opened',
  'incident.resolved',
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

/** Headers rant sends with every webhook delivery. */
export const SIGNATURE_HEADER = 'x-rant-signature';
export const EVENT_HEADER = 'x-rant-event';

/** Outbound delivery timeout (ms). */
export const WEBHOOK_TIMEOUT_MS = 5_000;
