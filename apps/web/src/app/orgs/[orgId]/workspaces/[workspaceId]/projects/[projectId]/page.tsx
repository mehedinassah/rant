'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  epics as epicsApi,
  initials,
  issues as issuesApi,
  ISSUE_COLUMNS,
  projects as projectsApi,
  sprints as sprintsApi,
  PRIORITY_META,
  TYPE_META,
  type Epic,
  type Issue,
  type IssueStatus,
  type IssueType,
  type Project,
  type Scope,
  type Sprint,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import { IssueDrawer } from './issue-drawer';

export default function BoardPage() {
  const ready = useRequireAuth();
  const params = useParams<{ orgId: string; workspaceId: string; projectId: string }>();
  const scope: Scope = {
    orgId: params.orgId,
    workspaceId: params.workspaceId,
    projectId: params.projectId,
  };

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [items, setItems] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sprintFilter, setSprintFilter] = useState('');
  const [epicFilter, setEpicFilter] = useState('');
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<IssueStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, e, i] = await Promise.all([
        projectsApi.get(scope),
        sprintsApi.list(scope),
        epicsApi.list(scope),
        issuesApi.list(scope),
      ]);
      setProject(p);
      setSprints(s);
      setEpics(e);
      setItems(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.workspaceId, params.projectId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!sprintFilter || i.sprint?.id === sprintFilter) &&
          (!epicFilter || i.epic?.id === epicFilter),
      ),
    [items, sprintFilter, epicFilter],
  );

  async function moveIssue(issueId: string, status: IssueStatus) {
    const current = items.find((i) => i.id === issueId);
    if (!current || current.status === status) return;
    // optimistic
    setItems((prev) => prev.map((i) => (i.id === issueId ? { ...i, status } : i)));
    try {
      await issuesApi.update(scope, issueId, { status });
    } catch {
      await load(); // revert on failure
    }
  }

  if (!ready) return null;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/10 px-6 py-4">
        <Link href={`/orgs/${scope.orgId}`} className="text-sm text-white/50 hover:text-white">
          ← Back
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70">
            {project?.key}
          </span>
          <h1 className="text-xl font-semibold">{project?.name ?? 'Board'}</h1>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Select value={sprintFilter} onChange={setSprintFilter} placeholder="All sprints">
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={epicFilter} onChange={setEpicFilter} placeholder="All epics">
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>

      {error && <p className="px-6 py-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="px-6 py-10 text-white/50">Loading board…</p>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto px-6 py-5">
          {ISSUE_COLUMNS.map((col) => {
            const colIssues = filtered.filter((i) => i.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingId) void moveIssue(draggingId, col.status);
                  setDraggingId(null);
                }}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-white/10 bg-[var(--color-ink-soft)]/50"
              >
                <div className="flex items-center justify-between px-3 py-3">
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="rounded-full bg-white/10 px-2 text-xs text-white/50">
                    {colIssues.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {colIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      projectKey={project?.key ?? ''}
                      onClick={() => setOpenIssueId(issue.id)}
                      onDragStart={() => setDraggingId(issue.id)}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))}
                  <button
                    onClick={() => setCreating(col.status)}
                    className="rounded-lg border border-dashed border-white/10 py-1.5 text-xs text-white/40 hover:border-white/30 hover:text-white/70"
                  >
                    + Add issue
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NewIssueModal
          scope={scope}
          status={creating}
          onClose={() => setCreating(null)}
          onCreated={async () => {
            setCreating(null);
            await load();
          }}
        />
      )}

      {openIssueId && (
        <IssueDrawer
          scope={scope}
          issueId={openIssueId}
          projectKey={project?.key ?? ''}
          onClose={() => setOpenIssueId(null)}
          onChanged={load}
        />
      )}
    </main>
  );
}

function IssueCard({
  issue,
  projectKey,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  issue: Issue;
  projectKey: string;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const type = TYPE_META[issue.type];
  const pri = PRIORITY_META[issue.priority];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-white/10 bg-[var(--color-ink)] p-3 transition hover:border-[var(--color-accent)]/50"
    >
      <p className="text-sm">{issue.title}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
        <span style={{ color: type.color }} title={type.label}>
          {type.icon}
        </span>
        <span className="font-mono">
          {projectKey}-{issue.number}
        </span>
        <span
          className="ml-1 inline-block h-2 w-2 rounded-full"
          style={{ background: pri.color }}
          title={`Priority: ${pri.label}`}
        />
        <div className="ml-auto flex items-center gap-2">
          {issue.storyPoints != null && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
              {issue.storyPoints}
            </span>
          )}
          {issue.assignee && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/30 text-[10px] text-[var(--color-accent-soft)]"
              title={issue.assignee.name}
            >
              {initials(issue.assignee.name)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-2 py-1.5 text-white/80 outline-none focus:border-[var(--color-accent)]"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function NewIssueModal({
  scope,
  status,
  onClose,
  onCreated,
}: {
  scope: Scope;
  status: IssueStatus;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<IssueType>('TASK');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await issuesApi.create(scope, { title, type });
      if (status !== 'BACKLOG') {
        await issuesApi.update(scope, created.id, { status });
      }
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-5"
      >
        <h3 className="mb-4 text-lg font-semibold">New issue</h3>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
        <div className="mt-3 flex gap-2">
          {(['TASK', 'STORY', 'BUG'] as IssueType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                type === t
                  ? 'border-[var(--color-accent)] text-white'
                  : 'border-white/10 text-white/50'
              }`}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-white/60">
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
