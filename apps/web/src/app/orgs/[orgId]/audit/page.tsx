'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { audit as auditApi, type AuditLog } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

const PAGE_SIZE = 25;

function timeFull(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Colour-code by the verb after the dot (created/updated/deleted/...). */
function actionColor(action: string): string {
  if (/(created|opened|queued|uploaded|invited)$/.test(action)) return '#22c55e';
  if (/(deleted|revoked|failed|cancelled)$/.test(action)) return '#ef4444';
  if (/(updated|changed|resumed|restored|acknowledged)$/.test(action)) return '#f59e0b';
  return '#6d5efc';
}

export default function AuditPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.logs(orgId, { page, pageSize: PAGE_SIZE, action: appliedFilter || undefined });
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, page, appliedFilter]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Audit log</h1>
      <p className="text-sm text-white/40">
        Every meaningful action, immutably recorded. Owners and admins only.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedFilter(filter.trim());
        }}
        className="mt-5 flex gap-2"
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action (e.g. deployment, member.role)"
          className="flex-1 rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
          Filter
        </button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-red-400">
          {error.includes('role') || error.includes('Forbidden')
            ? 'Only organization owners and admins can view the audit log.'
            : error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : logs.length === 0 && !error ? (
        <p className="mt-8 text-white/50">No audit entries{appliedFilter ? ` matching “${appliedFilter}”` : ''}.</p>
      ) : (
        !error && (
          <>
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              {logs.map((log, i) => (
                <div
                  key={log.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3 ${i > 0 ? 'border-t border-white/10' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-xs"
                        style={{ color: actionColor(log.action), background: `${actionColor(log.action)}1a` }}
                      >
                        {log.action}
                      </span>
                      {log.targetType && (
                        <span className="truncate text-xs text-white/40">
                          {log.targetType}
                          {log.targetId ? ` · ${log.targetId.slice(0, 10)}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      {log.actor?.name ?? 'system'} · {timeFull(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-white/50">
              <span>
                {total} entr{total === 1 ? 'y' : 'ies'} · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )
      )}
    </main>
  );
}
