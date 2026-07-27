'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  incidents as incidentsApi,
  monitors as monitorsApi,
  streamMonitor,
  ENV_TYPE_META,
  INCIDENT_STATUS_META,
  MONITOR_STATUS_META,
  SEVERITY_META,
  type MetricSample,
  type MonitorSnapshot,
  type MonitorStatus,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function StatusBadge({ status }: { status: MonitorStatus }) {
  const m = MONITOR_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={m.active ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

/** Live latency chart drawn straight from the SSE sample stream. */
function LatencyChart({ samples }: { samples: MetricSample[] }) {
  const W = 640;
  const H = 160;
  const pad = 8;
  const pts = samples.slice(-120);

  const { path, area, max } = useMemo(() => {
    if (pts.length === 0) return { path: '', area: '', max: 0 };
    const maxLat = Math.max(100, ...pts.map((s) => s.latencyMs));
    const x = (i: number) => pad + (i / Math.max(1, pts.length - 1)) * (W - pad * 2);
    const y = (v: number) => H - pad - (v / maxLat) * (H - pad * 2);
    const line = pts.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.latencyMs).toFixed(1)}`).join(' ');
    const areaPath = `${line} L ${x(pts.length - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
    return { path: line, area: areaPath, max: maxLat };
  }, [pts]);

  if (pts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm text-white/40">
        Waiting for the first health check…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d5efc" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6d5efc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lat)" />
        <path d={path} fill="none" stroke="#a99bff" strokeWidth="1.5" />
        {pts.map((s, i) => {
          if (s.up) return null;
          const x = pad + (i / Math.max(1, pts.length - 1)) * (W - pad * 2);
          return <line key={s.id} x1={x} y1={pad} x2={x} y2={H - pad} stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>0 ms</span>
        <span>peak {Math.round(max)} ms · red = down</span>
      </div>
    </div>
  );
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function MonitorDetailPage() {
  const ready = useRequireAuth();
  const { orgId, repoId, monitorId } = useParams<{
    orgId: string;
    repoId: string;
    monitorId: string;
  }>();
  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    stopRef.current = streamMonitor(orgId, repoId, monitorId, setSnap);
    return () => stopRef.current?.();
  }, [ready, orgId, repoId, monitorId]);

  const refresh = useCallback(async () => {
    const [m, inc] = await Promise.all([
      monitorsApi.get(orgId, repoId, monitorId),
      incidentsApi.list(orgId, repoId),
    ]);
    setSnap((prev) => ({
      monitor: m,
      samples: prev?.samples ?? [],
      incidents: inc.filter((i) => i.monitor?.id === monitorId),
      summary: prev?.summary ?? m.summary ?? { samples: 0, uptimePct: 0, avgLatencyMs: null, lastLatencyMs: null, lastStatusCode: null },
    }));
  }, [orgId, repoId, monitorId]);

  async function simulate(kind: 'outage' | 'recover') {
    setBusy('sim');
    setError(null);
    try {
      await monitorsApi.simulate(orgId, repoId, monitorId, kind);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function incidentAction(id: string, action: 'acknowledge' | 'resolve') {
    setBusy(id);
    try {
      await incidentsApi[action](orgId, repoId, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;
  if (error && !snap) return <main className="mx-auto max-w-4xl px-6 py-10 text-red-400">{error}</main>;
  if (!snap?.monitor) return <main className="mx-auto max-w-4xl px-6 py-10 text-white/50">Connecting…</main>;

  const m = snap.monitor;
  const s = snap.summary;
  const env = m.environment;
  const chaosActive = m.chaosUntil ? new Date(m.chaosUntil).getTime() > Date.now() : false;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/orgs/${orgId}/repos/${repoId}/monitoring`}
        className="text-sm text-white/50 hover:text-white"
      >
        ← Monitoring
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {env && ENV_TYPE_META[env.type].icon} {env?.name}
          </h1>
          <StatusBadge status={m.status} />
        </div>
        {chaosActive ? (
          <button
            onClick={() => simulate('recover')}
            disabled={busy === 'sim'}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            ✓ Recover
          </button>
        ) : (
          <button
            onClick={() => simulate('outage')}
            disabled={busy === 'sim' || !m.target}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            ⚡ Simulate outage
          </button>
        )}
      </div>

      {m.target && (
        <a
          href={m.target}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-sm text-[var(--color-accent-soft)] hover:underline"
        >
          {m.target} ↗
        </a>
      )}
      {chaosActive && (
        <p className="mt-2 text-xs text-red-400">
          Outage injected — health checks are failing until {timeAgo(m.chaosUntil)} passes.
        </p>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Uptime (30m)', value: `${s.uptimePct}%` },
          { label: 'Avg latency', value: s.avgLatencyMs != null ? `${s.avgLatencyMs} ms` : '—' },
          { label: 'Last latency', value: s.lastLatencyMs != null ? `${s.lastLatencyMs} ms` : '—' },
          { label: 'Last status', value: s.lastStatusCode != null ? String(s.lastStatusCode) : '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] px-4 py-3">
            <div className="text-xl font-semibold">{stat.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Live chart */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
          Response time <span className="ml-2 text-xs font-normal text-white/40">live</span>
        </h2>
        <LatencyChart samples={snap.samples} />
      </div>

      {/* Incidents */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Incidents</h2>
        {snap.incidents.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">No incidents recorded for this monitor.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {snap.incidents.map((inc) => {
              const sm = INCIDENT_STATUS_META[inc.status];
              const sev = SEVERITY_META[inc.severity];
              return (
                <div key={inc.id} className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ color: sev.color, background: `${sev.color}1a` }}
                      >
                        {sev.label}
                      </span>
                      <span className="text-sm">{inc.title}</span>
                    </div>
                    <span className="text-xs" style={{ color: sm.color }}>{sm.label}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                    <span>opened {timeAgo(inc.startedAt)}</span>
                    {inc.resolvedAt && <span>· resolved {timeAgo(inc.resolvedAt)}</span>}
                    {inc.issue && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">
                        bug #{inc.issue.number}
                      </span>
                    )}
                  </div>
                  {inc.status !== 'RESOLVED' && (
                    <div className="mt-3 flex gap-2">
                      {inc.status === 'OPEN' && (
                        <button
                          onClick={() => incidentAction(inc.id, 'acknowledge')}
                          disabled={busy === inc.id}
                          className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => incidentAction(inc.id, 'resolve')}
                        disabled={busy === inc.id}
                        className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
