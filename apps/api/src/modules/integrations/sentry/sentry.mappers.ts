import { IncidentSeverity } from '@rant/database';

/**
 * Pure Sentry webhook → rant incident mapping. Kept free of Nest/Prisma so the
 * level→severity and action→lifecycle decisions are unit-testable.
 */

export interface SentryIssue {
  id?: string | number;
  title?: string;
  culprit?: string;
  level?: string;
  status?: string;
  permalink?: string;
  firstSeen?: string;
  lastSeen?: string;
  project?: { id?: string | number; slug?: string; name?: string };
  metadata?: { type?: string; value?: string };
}

export interface SentryWebhookPayload {
  action?: string;
  resource?: string;
  installation?: { uuid?: string };
  data?: { issue?: SentryIssue };
}

export type SentryIncidentAction = 'open' | 'resolve';

export interface NormalizedSentryIssue {
  action: SentryIncidentAction;
  issueId: string;
  projectId: string;
  projectName: string | null;
  title: string;
  culprit: string | null;
  permalink: string | null;
  level: string;
  severity: IncidentSeverity;
  firstSeen: Date | null;
}

/** Sentry issue actions that change incident state. Others are ignored. */
export function incidentActionFor(action: string): SentryIncidentAction | null {
  switch (action) {
    case 'created':
    case 'unresolved':
      return 'open';
    case 'resolved':
      return 'resolve';
    default:
      return null;
  }
}

/** Sentry level → incident severity. Fatal is critical; errors are major. */
export function severityForLevel(level: string): IncidentSeverity {
  switch (level) {
    case 'fatal':
      return IncidentSeverity.CRITICAL;
    case 'error':
      return IncidentSeverity.MAJOR;
    default:
      return IncidentSeverity.MINOR;
  }
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalize an issue webhook; null when it isn't a modelable issue event. */
export function normalizeSentryWebhook(
  resource: string | undefined,
  body: SentryWebhookPayload,
): NormalizedSentryIssue | null {
  if ((resource ?? body?.resource ?? '') !== 'issue') return null;
  const action = incidentActionFor(String(body?.action ?? ''));
  if (!action) return null;

  const issue = body?.data?.issue;
  if (!issue) return null;

  const issueId = issue.id === undefined || issue.id === null ? '' : String(issue.id);
  const projectId =
    issue.project?.id !== undefined && issue.project?.id !== null
      ? String(issue.project.id)
      : issue.project?.slug ?? '';
  if (!issueId || !projectId) return null;

  const level = String(issue.level ?? 'error');
  return {
    action,
    issueId,
    projectId,
    projectName: issue.project?.name ?? issue.project?.slug ?? null,
    title: String(issue.title ?? issue.metadata?.value ?? 'Sentry issue'),
    culprit: issue.culprit ?? null,
    permalink: issue.permalink ?? null,
    level,
    severity: severityForLevel(level),
    firstSeen: toDate(issue.firstSeen),
  };
}
