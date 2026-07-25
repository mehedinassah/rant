'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  comments as commentsApi,
  initials,
  issues as issuesApi,
  ISSUE_COLUMNS,
  PRIORITY_META,
  TYPE_META,
  type IssueDetail,
  type IssuePriority,
  type IssueStatus,
  type Scope,
} from '@/lib/api';

const PRIORITIES: IssuePriority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function IssueDrawer({
  scope,
  issueId,
  projectKey,
  onClose,
  onChanged,
}: {
  scope: Scope;
  issueId: string;
  projectKey: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIssue(await issuesApi.get(scope, issueId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(data: { status?: IssueStatus; priority?: IssuePriority }) {
    if (!issue) return;
    setIssue({ ...issue, ...data });
    try {
      await issuesApi.update(scope, issue.id, data);
      await onChanged();
    } catch {
      await load();
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await commentsApi.create(scope, issueId, comment);
      setComment('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to comment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[var(--color-ink-soft)]"
      >
        {!issue ? (
          <p className="p-6 text-white/50">{error ?? 'Loading…'}</p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="font-mono text-sm text-white/60">
                {projectKey}-{issue.number}
              </span>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>

            <div className="px-5 py-4">
              <h2 className="text-lg font-semibold">{issue.title}</h2>
              {issue.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/60">
                  {issue.description}
                </p>
              )}

              <dl className="mt-5 space-y-3 text-sm">
                <Row label="Type">
                  <span style={{ color: TYPE_META[issue.type].color }}>
                    {TYPE_META[issue.type].icon} {TYPE_META[issue.type].label}
                  </span>
                </Row>
                <Row label="Status">
                  <select
                    value={issue.status}
                    onChange={(e) => patch({ status: e.target.value as IssueStatus })}
                    className="rounded border border-white/10 bg-black/30 px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                  >
                    {ISSUE_COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        {c.label}
                      </option>
                    ))}
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </Row>
                <Row label="Priority">
                  <select
                    value={issue.priority}
                    onChange={(e) => patch({ priority: e.target.value as IssuePriority })}
                    className="rounded border border-white/10 bg-black/30 px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                </Row>
                {issue.epic && (
                  <Row label="Epic">
                    <span
                      className="rounded px-2 py-0.5 text-xs"
                      style={{ background: (issue.epic.color ?? '#6d5efc') + '33' }}
                    >
                      {issue.epic.name}
                    </span>
                  </Row>
                )}
                {issue.sprint && <Row label="Sprint">{issue.sprint.name}</Row>}
                {issue.storyPoints != null && <Row label="Points">{issue.storyPoints}</Row>}
                {issue.assignee && (
                  <Row label="Assignee">
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/30 text-[10px] text-[var(--color-accent-soft)]">
                        {initials(issue.assignee.name)}
                      </span>
                      {issue.assignee.name}
                    </span>
                  </Row>
                )}
              </dl>
            </div>

            <div className="mt-auto border-t border-white/10 px-5 py-4">
              <h3 className="mb-3 text-sm font-medium text-white/70">
                Comments ({issue.comments.length})
              </h3>
              <ul className="space-y-3">
                {issue.comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                        {initials(c.author.name)}
                      </span>
                      <span className="font-medium">{c.author.name}</span>
                      <span className="text-xs text-white/30">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="ml-7 mt-1 whitespace-pre-wrap text-white/70">{c.body}</p>
                  </li>
                ))}
              </ul>

              <form onSubmit={addComment} className="mt-4 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment…"
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  disabled={busy}
                  className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-20 shrink-0 text-white/40">{label}</dt>
      <dd className="text-white/80">{children}</dd>
    </div>
  );
}
