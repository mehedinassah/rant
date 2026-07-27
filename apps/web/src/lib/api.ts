const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api/v1';

const ACCESS_KEY = 'rant.access';
const REFRESH_KEY = 'rant.refresh';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function setTokens(access: string, refresh: string): void {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

interface ApiError {
  message: string | string[];
}

/** Thin fetch wrapper that attaches the bearer token and unwraps errors. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── domain types ────────────────────────────────────────────

export interface UserRef {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
  _count?: { memberships: number; workspaces: number };
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { projects: number };
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  status: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  status: string;
}

export interface Epic {
  id: string;
  name: string;
  color?: string | null;
}

export type IssueStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'CANCELLED';
export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'SUBTASK';
export type IssuePriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Issue {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints?: number | null;
  epic?: { id: string; name: string; color?: string | null } | null;
  sprint?: { id: string; name: string; status: string } | null;
  assignee?: UserRef | null;
  reporter?: UserRef | null;
  _count?: { comments: number; children: number };
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
}

export interface IssueDetail extends Issue {
  comments: Comment[];
}

// ── scope helper ────────────────────────────────────────────

export interface Scope {
  orgId: string;
  workspaceId: string;
  projectId: string;
}

const projectBase = (s: Scope) =>
  `/organizations/${s.orgId}/workspaces/${s.workspaceId}/projects/${s.projectId}`;

// ── endpoint groups ─────────────────────────────────────────

export const auth = {
  register: (data: { name: string; email: string; password: string }) =>
    api<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api<{ id: string; name: string; email: string }>('/auth/me'),
};

export const organizations = {
  list: () => api<Organization[]>('/organizations'),
  get: (orgId: string) => api<Organization>(`/organizations/${orgId}`),
  create: (data: { name: string; slug: string }) =>
    api<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
};

export const workspaces = {
  list: (orgId: string) => api<Workspace[]>(`/organizations/${orgId}/workspaces`),
  create: (orgId: string, data: { name: string; slug: string; description?: string }) =>
    api<Workspace>(`/organizations/${orgId}/workspaces`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const projects = {
  list: (orgId: string, workspaceId: string) =>
    api<Project[]>(`/organizations/${orgId}/workspaces/${workspaceId}/projects`),
  get: (s: Scope) => api<Project>(projectBase(s)),
  create: (
    orgId: string,
    workspaceId: string,
    data: { name: string; key: string; description?: string },
  ) =>
    api<Project>(`/organizations/${orgId}/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const sprints = {
  list: (s: Scope) => api<Sprint[]>(`${projectBase(s)}/sprints`),
};

export const epics = {
  list: (s: Scope) => api<Epic[]>(`${projectBase(s)}/epics`),
};

export interface IssueFilters {
  status?: IssueStatus;
  type?: IssueType;
  sprintId?: string;
  epicId?: string;
  assigneeId?: string;
}

export const issues = {
  list: (s: Scope, filters: IssueFilters = {}) => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    const qs = q.toString();
    return api<Issue[]>(`${projectBase(s)}/issues${qs ? `?${qs}` : ''}`);
  },
  get: (s: Scope, issueId: string) => api<IssueDetail>(`${projectBase(s)}/issues/${issueId}`),
  create: (
    s: Scope,
    data: {
      title: string;
      type?: IssueType;
      priority?: IssuePriority;
      storyPoints?: number;
      sprintId?: string;
      epicId?: string;
      assigneeId?: string;
    },
  ) => api<Issue>(`${projectBase(s)}/issues`, { method: 'POST', body: JSON.stringify(data) }),
  update: (
    s: Scope,
    issueId: string,
    data: Partial<{
      title: string;
      description: string;
      status: IssueStatus;
      priority: IssuePriority;
      type: IssueType;
      storyPoints: number;
      sprintId: string | null;
      epicId: string | null;
      assigneeId: string | null;
    }>,
  ) =>
    api<Issue>(`${projectBase(s)}/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const comments = {
  create: (s: Scope, issueId: string, body: string) =>
    api<Comment>(`${projectBase(s)}/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

// ── repositories & CI/CD ────────────────────────────────────

export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED';

export type PipelineTrigger = 'PUSH' | 'PULL_REQUEST' | 'MANUAL' | 'SCHEDULE';

export interface Repository {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: string;
  defaultBranch: string;
  project?: { id: string; key: string; name: string } | null;
  _count?: { branches: number; pullRequests: number; commits: number };
}

export interface Pipeline {
  id: string;
  name: string;
  triggers: PipelineTrigger[];
  branchFilter?: string | null;
  isActive: boolean;
  definition?: { jobs: { name: string; steps: { name: string; run: string }[] }[] };
  _count?: { runs: number };
}

export interface RunStep {
  id: string;
  name: string;
  command: string;
  status: RunStatus;
  logs: string;
  orderIdx: number;
}

export interface RunJob {
  id: string;
  name: string;
  status: RunStatus;
  orderIdx: number;
  steps: RunStep[];
}

export interface RunSummary {
  id: string;
  number: number;
  status: RunStatus;
  trigger: PipelineTrigger;
  branch: string;
  commitSha?: string | null;
  createdAt: string;
  pipeline?: { id: string; name: string } | null;
  triggeredBy?: UserRef | null;
  _count?: { jobs: number };
}

export interface RunDetail extends RunSummary {
  jobs: RunJob[];
  startedAt?: string | null;
  finishedAt?: string | null;
}

const repoBase = (orgId: string, repoId: string) =>
  `/organizations/${orgId}/repositories/${repoId}`;

export const repositories = {
  list: (orgId: string) => api<Repository[]>(`/organizations/${orgId}/repositories`),
  get: (orgId: string, repoId: string) => api<Repository>(repoBase(orgId, repoId)),
  create: (
    orgId: string,
    data: { name: string; slug: string; description?: string; projectId?: string },
  ) =>
    api<Repository>(`/organizations/${orgId}/repositories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const pipelines = {
  list: (orgId: string, repoId: string) =>
    api<Pipeline[]>(`${repoBase(orgId, repoId)}/pipelines`),
  get: (orgId: string, repoId: string, pipelineId: string) =>
    api<Pipeline>(`${repoBase(orgId, repoId)}/pipelines/${pipelineId}`),
  create: (
    orgId: string,
    repoId: string,
    data: { name: string; triggers?: PipelineTrigger[]; branchFilter?: string },
  ) =>
    api<Pipeline>(`${repoBase(orgId, repoId)}/pipelines`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  run: (orgId: string, repoId: string, pipelineId: string, branch?: string) =>
    api<RunSummary>(`${repoBase(orgId, repoId)}/pipelines/${pipelineId}/run`, {
      method: 'POST',
      body: JSON.stringify(branch ? { branch } : {}),
    }),
};

export const runs = {
  list: (orgId: string, repoId: string) => api<RunSummary[]>(`${repoBase(orgId, repoId)}/runs`),
  get: (orgId: string, repoId: string, runId: string) =>
    api<RunDetail>(`${repoBase(orgId, repoId)}/runs/${runId}`),
  cancel: (orgId: string, repoId: string, runId: string) =>
    api<RunDetail>(`${repoBase(orgId, repoId)}/runs/${runId}/cancel`, { method: 'POST' }),
};

/**
 * Subscribes to a run's live Server-Sent Events stream. We use fetch (not the
 * browser EventSource) because EventSource can't attach the Authorization
 * header the API's JWT guard requires. Returns an unsubscribe function.
 */
export function streamRun(
  orgId: string,
  repoId: string,
  runId: string,
  onUpdate: (run: RunDetail) => void,
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}${repoBase(orgId, repoId)}/runs/${runId}/stream`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            onUpdate(JSON.parse(line.slice(5).trim()) as RunDetail);
          } catch {
            /* ignore partial frames */
          }
        }
      }
    } catch {
      /* aborted or network closed — expected on unmount / run completion */
    }
  })();

  return () => controller.abort();
}

// ── deployments ─────────────────────────────────────────────

export type DeploymentStatus =
  | 'QUEUED'
  | 'BUILDING'
  | 'DEPLOYING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export type EnvironmentType = 'PRODUCTION' | 'PREVIEW' | 'STAGING' | 'DEVELOPMENT';

export interface DeploymentRef {
  id: string;
  number: number;
  status: DeploymentStatus;
  url?: string | null;
  branch: string;
  commitSha?: string | null;
  createdAt: string;
}

export interface Environment {
  id: string;
  name: string;
  slug: string;
  type: EnvironmentType;
  isProduction: boolean;
  branchFilter?: string | null;
  currentDeployment?: DeploymentRef | null;
  _count?: { deployments: number };
}

export interface DeploymentSummary {
  id: string;
  number: number;
  status: DeploymentStatus;
  branch: string;
  commitSha?: string | null;
  url?: string | null;
  isRollback: boolean;
  createdAt: string;
  environment?: { id: string; name: string; slug: string; type: EnvironmentType; isProduction: boolean } | null;
  triggeredBy?: UserRef | null;
}

export interface DeploymentDetail extends DeploymentSummary {
  logs: string;
  pullRequestId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export const environments = {
  list: (orgId: string, repoId: string) =>
    api<Environment[]>(`${repoBase(orgId, repoId)}/environments`),
  create: (
    orgId: string,
    repoId: string,
    data: { name: string; slug: string; type?: EnvironmentType; branchFilter?: string },
  ) =>
    api<Environment>(`${repoBase(orgId, repoId)}/environments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deploy: (orgId: string, repoId: string, envId: string, branch?: string) =>
    api<DeploymentSummary>(`${repoBase(orgId, repoId)}/environments/${envId}/deploy`, {
      method: 'POST',
      body: JSON.stringify(branch ? { branch } : {}),
    }),
  rollback: (orgId: string, repoId: string, envId: string, deploymentId: string) =>
    api<DeploymentSummary>(`${repoBase(orgId, repoId)}/environments/${envId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ deploymentId }),
    }),
};

export const deployments = {
  list: (orgId: string, repoId: string) =>
    api<DeploymentSummary[]>(`${repoBase(orgId, repoId)}/deployments`),
  get: (orgId: string, repoId: string, deploymentId: string) =>
    api<DeploymentDetail>(`${repoBase(orgId, repoId)}/deployments/${deploymentId}`),
  cancel: (orgId: string, repoId: string, deploymentId: string) =>
    api<DeploymentDetail>(`${repoBase(orgId, repoId)}/deployments/${deploymentId}/cancel`, {
      method: 'POST',
    }),
};

/** Subscribes to a deployment's live SSE stream (fetch-based, JWT-aware). */
export function streamDeployment(
  orgId: string,
  repoId: string,
  deploymentId: string,
  onUpdate: (d: DeploymentDetail) => void,
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();
  (async () => {
    try {
      const res = await fetch(
        `${API_BASE}${repoBase(orgId, repoId)}/deployments/${deploymentId}/stream`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: controller.signal },
      );
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            onUpdate(JSON.parse(line.slice(5).trim()) as DeploymentDetail);
          } catch {
            /* ignore partial frames */
          }
        }
      }
    } catch {
      /* aborted or closed — expected */
    }
  })();
  return () => controller.abort();
}

// ── monitoring ──────────────────────────────────────────────

export type MonitorStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'PAUSED' | 'UNKNOWN';
export type MonitorType = 'HTTP' | 'PING';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type IncidentSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface MetricSample {
  id: string;
  status: MonitorStatus;
  latencyMs: number;
  statusCode: number;
  up: boolean;
  checkedAt: string;
}

export interface MetricsSummary {
  samples: number;
  uptimePct: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastStatusCode: number | null;
}

export interface Monitor {
  id: string;
  name: string;
  type: MonitorType;
  target?: string | null;
  intervalSec: number;
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt?: string | null;
  chaosUntil?: string | null;
  environment?: {
    id: string;
    name: string;
    slug: string;
    type: EnvironmentType;
    isProduction: boolean;
  } | null;
  summary?: MetricsSummary;
  _count?: { incidents: number };
}

export interface Incident {
  id: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  title: string;
  summary?: string | null;
  issueId?: string | null;
  startedAt: string;
  resolvedAt?: string | null;
  monitor?: {
    id: string;
    name: string;
    environment?: { id: string; name: string; slug: string } | null;
  } | null;
  issue?: { id: string; number: number; title: string; projectId: string } | null;
}

export interface MonitorSnapshot {
  monitor: Monitor | null;
  samples: MetricSample[];
  incidents: Incident[];
  summary: MetricsSummary;
}

export const monitors = {
  list: (orgId: string, repoId: string) =>
    api<Monitor[]>(`${repoBase(orgId, repoId)}/monitors`),
  get: (orgId: string, repoId: string, monitorId: string) =>
    api<Monitor>(`${repoBase(orgId, repoId)}/monitors/${monitorId}`),
  metrics: (orgId: string, repoId: string, monitorId: string, minutes?: number) =>
    api<{ samples: MetricSample[]; summary: MetricsSummary }>(
      `${repoBase(orgId, repoId)}/monitors/${monitorId}/metrics${minutes ? `?minutes=${minutes}` : ''}`,
    ),
  update: (
    orgId: string,
    repoId: string,
    monitorId: string,
    data: Partial<{ name: string; intervalSec: number; isActive: boolean }>,
  ) =>
    api<Monitor>(`${repoBase(orgId, repoId)}/monitors/${monitorId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  simulate: (
    orgId: string,
    repoId: string,
    monitorId: string,
    kind: 'outage' | 'recover',
    durationSec?: number,
  ) =>
    api<{ success: boolean; chaosUntil: string | null }>(
      `${repoBase(orgId, repoId)}/monitors/${monitorId}/simulate`,
      { method: 'POST', body: JSON.stringify({ kind, durationSec }) },
    ),
};

export const incidents = {
  list: (orgId: string, repoId: string) =>
    api<Incident[]>(`${repoBase(orgId, repoId)}/incidents`),
  get: (orgId: string, repoId: string, incidentId: string) =>
    api<Incident>(`${repoBase(orgId, repoId)}/incidents/${incidentId}`),
  acknowledge: (orgId: string, repoId: string, incidentId: string) =>
    api<Incident>(`${repoBase(orgId, repoId)}/incidents/${incidentId}/acknowledge`, {
      method: 'POST',
    }),
  resolve: (orgId: string, repoId: string, incidentId: string) =>
    api<Incident>(`${repoBase(orgId, repoId)}/incidents/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

/** Subscribes to a monitor's live SSE stream (fetch-based, JWT-aware, endless). */
export function streamMonitor(
  orgId: string,
  repoId: string,
  monitorId: string,
  onUpdate: (snap: MonitorSnapshot) => void,
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();
  (async () => {
    try {
      const res = await fetch(
        `${API_BASE}${repoBase(orgId, repoId)}/monitors/${monitorId}/stream`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: controller.signal },
      );
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            onUpdate(JSON.parse(line.slice(5).trim()) as MonitorSnapshot);
          } catch {
            /* ignore partial frames */
          }
        }
      }
    } catch {
      /* aborted or closed — expected */
    }
  })();
  return () => controller.abort();
}

// ── notifications ───────────────────────────────────────────

export type NotificationType =
  | 'CI_FAILED'
  | 'DEPLOYMENT_READY'
  | 'DEPLOYMENT_FAILED'
  | 'INCIDENT_OPENED'
  | 'INCIDENT_RESOLVED'
  | 'PULL_REQUEST_OPENED';

export type NotificationCategory = 'CI' | 'DEPLOYMENT' | 'INCIDENT' | 'PULL_REQUEST';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body?: string | null;
  organizationId?: string | null;
  repositoryId?: string | null;
  linkPath?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  category: NotificationCategory;
  inApp: boolean;
  email: boolean;
}

export interface NotificationSnapshot {
  unread: number;
  latest: Notification[];
}

export const notifications = {
  list: (unreadOnly = false) =>
    api<Notification[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  unreadCount: () => api<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    api<{ success: boolean; count: number }>('/notifications/read-all', { method: 'POST' }),
  remove: (id: string) => api<{ success: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
  getPreferences: () => api<NotificationPreference[]>('/notifications/preferences'),
  updatePreferences: (preferences: NotificationPreference[]) =>
    api<NotificationPreference[]>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),
};

/** Subscribes to the live notification stream (unread count + latest). */
export function streamNotifications(onUpdate: (snap: NotificationSnapshot) => void): () => void {
  const controller = new AbortController();
  const token = getAccessToken();
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/stream`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            onUpdate(JSON.parse(line.slice(5).trim()) as NotificationSnapshot);
          } catch {
            /* ignore partial frames */
          }
        }
      }
    } catch {
      /* aborted or closed — expected */
    }
  })();
  return () => controller.abort();
}

// ── documentation ───────────────────────────────────────────

export interface DocSummary {
  id: string;
  title: string;
  icon?: string | null;
  parentId?: string | null;
  position: number;
  updatedAt: string;
}

export interface DocDetail {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  title: string;
  content: string;
  icon?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  author: UserRef;
  lastEditedBy?: UserRef | null;
  _count?: { revisions: number; children: number };
}

export interface DocRevisionSummary {
  id: string;
  title: string;
  editedBy?: UserRef | null;
  createdAt: string;
}

export interface DocRevisionDetail extends DocRevisionSummary {
  content: string;
}

const docsBase = (orgId: string, workspaceId: string) =>
  `/organizations/${orgId}/workspaces/${workspaceId}/docs`;

export const docs = {
  list: (orgId: string, workspaceId: string) =>
    api<DocSummary[]>(docsBase(orgId, workspaceId)),
  get: (orgId: string, workspaceId: string, docId: string) =>
    api<DocDetail>(`${docsBase(orgId, workspaceId)}/${docId}`),
  create: (
    orgId: string,
    workspaceId: string,
    data: { title: string; content?: string; icon?: string; parentId?: string | null },
  ) =>
    api<DocDetail>(docsBase(orgId, workspaceId), {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    orgId: string,
    workspaceId: string,
    docId: string,
    data: Partial<{ title: string; content: string; icon: string; parentId: string | null; position: number }>,
  ) =>
    api<DocDetail>(`${docsBase(orgId, workspaceId)}/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (orgId: string, workspaceId: string, docId: string) =>
    api<{ success: boolean }>(`${docsBase(orgId, workspaceId)}/${docId}`, { method: 'DELETE' }),
  revisions: (orgId: string, workspaceId: string, docId: string) =>
    api<DocRevisionSummary[]>(`${docsBase(orgId, workspaceId)}/${docId}/revisions`),
  revision: (orgId: string, workspaceId: string, docId: string, revisionId: string) =>
    api<DocRevisionDetail>(`${docsBase(orgId, workspaceId)}/${docId}/revisions/${revisionId}`),
  restore: (orgId: string, workspaceId: string, docId: string, revisionId: string) =>
    api<DocDetail>(`${docsBase(orgId, workspaceId)}/${docId}/revisions/${revisionId}/restore`, {
      method: 'POST',
    }),
};

// ── search ──────────────────────────────────────────────────

export type SearchType =
  | 'issue'
  | 'project'
  | 'repository'
  | 'pull_request'
  | 'doc'
  | 'incident';

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  linkPath: string;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  results: SearchResult[];
}

export interface SearchResponse {
  query: string;
  total: number;
  groups: SearchGroup[];
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

export const search = {
  run: (orgId: string, q: string, types?: SearchType[]) => {
    const params = new URLSearchParams({ q });
    if (types && types.length) params.set('types', types.join(','));
    return api<SearchResponse>(`/organizations/${orgId}/search?${params.toString()}`);
  },
  listSaved: (orgId: string) => api<SavedSearch[]>(`/organizations/${orgId}/search/saved`),
  createSaved: (orgId: string, data: { name: string; query: string }) =>
    api<SavedSearch>(`/organizations/${orgId}/search/saved`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeSaved: (orgId: string, id: string) =>
    api<{ success: boolean }>(`/organizations/${orgId}/search/saved/${id}`, { method: 'DELETE' }),
};

export const SEARCH_TYPE_META: Record<SearchType, { label: string; icon: string; color: string }> = {
  issue: { label: 'Issue', icon: '✔', color: '#6d5efc' },
  project: { label: 'Project', icon: '◈', color: '#22c55e' },
  repository: { label: 'Repo', icon: '⎇', color: '#3b82f6' },
  pull_request: { label: 'PR', icon: '⑃', color: '#a99bff' },
  doc: { label: 'Doc', icon: '📄', color: '#eab308' },
  incident: { label: 'Incident', icon: '◉', color: '#ef4444' },
};

// ── API platform (keys + webhooks) ──────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export type WebhookDeliveryStatus = 'SUCCESS' | 'FAILED';

export interface WebhookDelivery {
  id: string;
  event: string;
  status: WebhookDeliveryStatus;
  statusCode?: number | null;
  error?: string | null;
  createdAt: string;
}

const orgBase = (orgId: string) => `/organizations/${orgId}`;

/** Origin of the API, for linking to the OpenAPI docs UI. */
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiPlatform = {
  listKeys: (orgId: string) => api<ApiKey[]>(`${orgBase(orgId)}/api-keys`),
  createKey: (orgId: string, data: { name: string; expiresInDays?: number }) =>
    api<ApiKeyCreated>(`${orgBase(orgId)}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  revokeKey: (orgId: string, keyId: string) =>
    api<{ success: boolean }>(`${orgBase(orgId)}/api-keys/${keyId}`, { method: 'DELETE' }),

  webhookEvents: (orgId: string) => api<string[]>(`${orgBase(orgId)}/webhook-events`),
  listWebhooks: (orgId: string) => api<Webhook[]>(`${orgBase(orgId)}/webhooks`),
  createWebhook: (orgId: string, data: { url: string; events?: string[] }) =>
    api<Webhook>(`${orgBase(orgId)}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateWebhook: (
    orgId: string,
    webhookId: string,
    data: Partial<{ url: string; events: string[]; isActive: boolean }>,
  ) =>
    api<Webhook>(`${orgBase(orgId)}/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  removeWebhook: (orgId: string, webhookId: string) =>
    api<{ success: boolean }>(`${orgBase(orgId)}/webhooks/${webhookId}`, { method: 'DELETE' }),
  deliveries: (orgId: string, webhookId: string) =>
    api<WebhookDelivery[]>(`${orgBase(orgId)}/webhooks/${webhookId}/deliveries`),
};

// ── analytics ───────────────────────────────────────────────

export interface DayPoint {
  date: string;
  count: number;
}

export interface AnalyticsOverview {
  range: { days: number; from: string };
  totals: {
    projects: number;
    repositories: number;
    members: number;
    openIssues: number;
    deployments: number;
    openIncidents: number;
  };
  issues: {
    byStatus: Record<string, number>;
    createdSeries: DayPoint[];
    completedSeries: DayPoint[];
  };
  deployments: {
    series: DayPoint[];
    total: number;
    ready: number;
    failed: number;
    successRate: number;
  };
  ci: { total: number; success: number; failed: number; passRate: number };
  incidents: { total: number; open: number; mttrMinutes: number | null };
  monitors: { total: number; up: number };
  topRepos: { id: string; name: string; deployments: number }[];
}

export const analytics = {
  overview: (orgId: string, days?: number) =>
    api<AnalyticsOverview>(
      `/organizations/${orgId}/analytics/overview${days ? `?days=${days}` : ''}`,
    ),
};

// ── small shared display helpers ────────────────────────────

export const ISSUE_COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'IN_REVIEW', label: 'In Review' },
  { status: 'DONE', label: 'Done' },
];

export const PRIORITY_META: Record<IssuePriority, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: '#ef4444' },
  HIGH: { label: 'High', color: '#f59e0b' },
  MEDIUM: { label: 'Medium', color: '#eab308' },
  LOW: { label: 'Low', color: '#22c55e' },
  NONE: { label: 'None', color: '#6b7280' },
};

export const TYPE_META: Record<IssueType, { label: string; icon: string; color: string }> = {
  STORY: { label: 'Story', icon: '◆', color: '#22c55e' },
  TASK: { label: 'Task', icon: '✔', color: '#6d5efc' },
  BUG: { label: 'Bug', icon: '●', color: '#ef4444' },
  SUBTASK: { label: 'Subtask', icon: '▷', color: '#3b82f6' },
};

export const RUN_STATUS_META: Record<
  RunStatus,
  { label: string; color: string; dot: string }
> = {
  QUEUED: { label: 'Queued', color: '#9ca3af', dot: '○' },
  RUNNING: { label: 'Running', color: '#3b82f6', dot: '◐' },
  SUCCESS: { label: 'Success', color: '#22c55e', dot: '●' },
  FAILED: { label: 'Failed', color: '#ef4444', dot: '✕' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', dot: '⊘' },
  SKIPPED: { label: 'Skipped', color: '#6b7280', dot: '–' },
};

export const TRIGGER_META: Record<PipelineTrigger, { label: string; icon: string }> = {
  PUSH: { label: 'Push', icon: '↑' },
  PULL_REQUEST: { label: 'Pull request', icon: '⑃' },
  MANUAL: { label: 'Manual', icon: '▸' },
  SCHEDULE: { label: 'Schedule', icon: '◷' },
};

export const DEPLOY_STATUS_META: Record<
  DeploymentStatus,
  { label: string; color: string; dot: string; active: boolean }
> = {
  QUEUED: { label: 'Queued', color: '#9ca3af', dot: '○', active: true },
  BUILDING: { label: 'Building', color: '#f59e0b', dot: '◐', active: true },
  DEPLOYING: { label: 'Deploying', color: '#3b82f6', dot: '◐', active: true },
  READY: { label: 'Ready', color: '#22c55e', dot: '●', active: false },
  FAILED: { label: 'Failed', color: '#ef4444', dot: '✕', active: false },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', dot: '⊘', active: false },
};

export const ENV_TYPE_META: Record<EnvironmentType, { label: string; icon: string }> = {
  PRODUCTION: { label: 'Production', icon: '◆' },
  PREVIEW: { label: 'Preview', icon: '◇' },
  STAGING: { label: 'Staging', icon: '▲' },
  DEVELOPMENT: { label: 'Development', icon: '●' },
};

export const MONITOR_STATUS_META: Record<
  MonitorStatus,
  { label: string; color: string; dot: string; active: boolean }
> = {
  UP: { label: 'Operational', color: '#22c55e', dot: '●', active: false },
  DEGRADED: { label: 'Degraded', color: '#f59e0b', dot: '◐', active: true },
  DOWN: { label: 'Down', color: '#ef4444', dot: '✕', active: true },
  PAUSED: { label: 'Paused', color: '#6b7280', dot: '⏸', active: false },
  UNKNOWN: { label: 'Not checked', color: '#9ca3af', dot: '○', active: false },
};

export const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; color: string }
> = {
  OPEN: { label: 'Open', color: '#ef4444' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: '#f59e0b' },
  RESOLVED: { label: 'Resolved', color: '#22c55e' },
};

export const SEVERITY_META: Record<IncidentSeverity, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: '#ef4444' },
  MAJOR: { label: 'Major', color: '#f59e0b' },
  MINOR: { label: 'Minor', color: '#eab308' },
};

export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; icon: string; color: string }
> = {
  CI_FAILED: { label: 'CI failed', icon: '✕', color: '#ef4444' },
  DEPLOYMENT_READY: { label: 'Deployed', icon: '▲', color: '#22c55e' },
  DEPLOYMENT_FAILED: { label: 'Deploy failed', icon: '▲', color: '#ef4444' },
  INCIDENT_OPENED: { label: 'Incident', icon: '◉', color: '#ef4444' },
  INCIDENT_RESOLVED: { label: 'Resolved', icon: '◉', color: '#22c55e' },
  PULL_REQUEST_OPENED: { label: 'Pull request', icon: '⑃', color: '#6d5efc' },
};

export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  CI: { label: 'Continuous integration', description: 'Pipeline run failures' },
  DEPLOYMENT: { label: 'Deployments', description: 'Releases and deploy failures' },
  INCIDENT: { label: 'Incidents', description: 'Outages opened and resolved' },
  PULL_REQUEST: { label: 'Pull requests', description: 'New pull requests to review' },
};

export function shortSha(sha?: string | null): string {
  return sha ? sha.slice(0, 7) : '—';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
