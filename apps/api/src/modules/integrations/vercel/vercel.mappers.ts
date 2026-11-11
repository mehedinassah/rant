/**
 * Pure Vercel webhook → rant deployment mapping. No Nest, no Prisma, no I/O, so
 * the interesting logic (event → lifecycle state, payload → record fields) is
 * unit-testable without a database or network.
 */

export type VercelDeploymentState = 'BUILDING' | 'READY' | 'FAILED' | 'CANCELLED';

export interface VercelDeploymentPayload {
  id?: string;
  url?: string;
  name?: string;
  target?: string | null;
  createdAt?: number;
  buildingAt?: number;
  ready?: number;
  meta?: Record<string, unknown>;
}

export interface VercelWebhookPayload {
  type?: string;
  payload?: {
    deployment?: VercelDeploymentPayload;
    project?: { id?: string; name?: string };
    team?: { id?: string };
    links?: { deployment?: string; project?: string };
  };
}

export interface NormalizedVercelDeployment {
  eventType: string;
  deploymentId: string;
  projectId: string;
  projectName: string | null;
  url: string | null;
  branch: string;
  commitSha: string | null;
  /** Provider pull-request id, when Vercel exposes the GitHub PR number. */
  pullRequestExternalId: string | null;
  target: string | null;
  state: VercelDeploymentState;
}

/** Map a Vercel webhook type onto deployment lifecycle state. Null = ignore. */
export function deploymentStateFor(eventType: string): VercelDeploymentState | null {
  switch (eventType) {
    case 'deployment.created':
    case 'deployment.building':
      return 'BUILDING';
    case 'deployment.ready':
    case 'deployment.succeeded':
      return 'READY';
    case 'deployment.error':
      return 'FAILED';
    case 'deployment.canceled':
    case 'deployment.cancelled':
      return 'CANCELLED';
    default:
      return null;
  }
}

/** Vercel sends hostnames (`app-123.vercel.app`); rant stores absolute URLs. */
export function absoluteUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Normalize a Vercel webhook body. Returns null for events rant doesn't model,
 * or when the payload is missing the ids needed to write an idempotent record.
 */
export function normalizeVercelWebhook(body: VercelWebhookPayload): NormalizedVercelDeployment | null {
  const eventType = typeof body?.type === 'string' ? body.type : '';
  const state = deploymentStateFor(eventType);
  if (!state) return null;

  const deployment = body?.payload?.deployment;
  const project = body?.payload?.project;
  const deploymentId = String(deployment?.id ?? body?.payload?.links?.deployment ?? '');
  const projectId = String(project?.id ?? body?.payload?.links?.project ?? '');
  if (!deploymentId || !projectId) return null;

  const meta = (deployment?.meta ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

  return {
    eventType,
    deploymentId,
    projectId,
    projectName: str(project?.name),
    url: absoluteUrl(deployment?.url),
    branch: str(meta.githubCommitRef) ?? str(deployment?.target) ?? 'main',
    commitSha: str(meta.githubCommitSha),
    pullRequestExternalId: str(meta.githubPrId),
    target: str(deployment?.target),
    state,
  };
}
