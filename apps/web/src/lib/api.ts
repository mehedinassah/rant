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

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
