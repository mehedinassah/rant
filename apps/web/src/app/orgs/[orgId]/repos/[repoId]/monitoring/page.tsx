'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  incidents as incidentsApi,
  monitors as monitorsApi,
  repositories,
  ENV_TYPE_META,
  INCIDENT_STATUS_META,
  MONITOR_STATUS_META,
  SEVERITY_META,
  type Incident,
  type Monitor,
  type MonitorStatus,
  type Repository,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function StatusBadge({ status }: { status: MonitorStatus }) {
  const m = MONITOR_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={m.active ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function MonitoringPage() {
  const ready = useRequireAuth();
  const { orgId, repoId } = useParams<{ orgId: string; repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, m, inc] = await Promise.all([
        repositories.get(orgId, repoId),
        monitorsApi.list(orgId, repoId),
        incidentsApi.list(orgId, repoId),
      ]);
      setRepo(r);
      setMonitors(m);
      setIncidents(inc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, repoId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // The scheduler probes continuously — keep the dashboard fresh.
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [ready, load]);

  async function simulate(monitorId: string, kind: 'outage' | 'recover') {
    setBusy(monitorId);
    setError(null);
    try {
      await monitorsApi.simulate(orgId, repoId, monitorId, kind);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function resolveIncident(incidentId: string) {
    setBusy(incidentId);
    try {
      await incidentsApi.resolve(orgId, repoId, incidentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}/repos/${repoId}`} className="text-sm text-white/50 hover:text-white">
        ← {repo?.name ?? 'Repository'}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Monitoring</h1>
      <p className="text-sm text-white/40">
        Live health of every environment. Checks run continuously; incidents open and resolve
        automatically.
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-white/50">Loading…</p>}

      {!loading && (
        <>
          {openIncidents.length > 0 && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {openIncidents.length} active incident{openIncidents.length > 1 ? 's' : ''}.
            </div>
          )}

          {/* Monitors */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {monitors.map((m) => {
              const chaosActive = m.chaosUntil ? new Date(m.chaosUntil).getTime() > Date.now() : false;
              return (
                <Link
                  key={m.id}
                  href={`/orgs/${orgId}/repos/${repoId}/monitoring/${m.id}`}
                  className="block rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4 transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      {m.environment && ENV_TYPE_META[m.environment.type].icon} {m.environment?.name}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>

                  {m.target ? (
                    <p className="mt-2 truncate font-mono text-xs text-[var(--color-accent-soft)]">
                      {m.target}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-white/30">No live deployment to probe yet.</p>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold">
                        {m.summary ? `${m.summary.uptimePct}%` : '—'}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">uptime</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {m.summary?.avgLatencyMs != null ? `${m.summary.avgLatencyMs}ms` : '—'}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">avg latency</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{m._count?.incidents ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/40">open incidents</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-white/40">checked {timeAgo(m.lastCheckedAt)}</span>
                    <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                      {chaosActive ? (
                        <button
                          onClick={() => simulate(m.id, 'recover')}
                          disabled={busy === m.id}
                          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          ✓ Recover
                        </button>
                      ) : (
                        <button
                          onClick={() => simulate(m.id, 'outage')}
                          disabled={busy === m.id || !m.target}
                          className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          ⚡ Simulate outage
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Incidents */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Incidents</h2>
            {incidents.length === 0 ? (
              <p className="mt-3 text-sm text-white/40">No incidents. All systems operational.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                {incidents.map((inc, i) => {
                  const sm = INCIDENT_STATUS_META[inc.status];
                  const sev = SEVERITY_META[inc.severity];
                  return (
                    <div
                      key={inc.id}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i > 0 ? 'border-t border-white/10' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                            style={{ color: sev.color, background: `${sev.color}1a` }}
                          >
                            {sev.label}
                          </span>
                          <span className="truncate text-sm">{inc.title}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                          <span style={{ color: sm.color }}>{sm.label}</span>
                          <span>· {timeAgo(inc.startedAt)}</span>
                          {inc.issue && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">
                              bug #{inc.issue.number}
                            </span>
                          )}
                        </div>
                      </div>
                      {inc.status !== 'RESOLVED' && (
                        <button
                          onClick={() => resolveIncident(inc.id)}
                          disabled={busy === inc.id}
                          className="ml-3 shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
