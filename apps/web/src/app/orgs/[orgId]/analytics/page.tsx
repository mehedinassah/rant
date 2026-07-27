'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  analytics as analyticsApi,
  ISSUE_COLUMNS,
  type AnalyticsOverview,
  type DayPoint,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] px-4 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-white/50">{hint}</div>}
    </div>
  );
}

/** Dependency-free grouped bar chart (two series over days). */
function BarChart({
  a,
  b,
  labelA,
  labelB,
  colorA = '#6d5efc',
  colorB = '#22c55e',
}: {
  a: DayPoint[];
  b?: DayPoint[];
  labelA: string;
  labelB?: string;
  colorA?: string;
  colorB?: string;
}) {
  const max = Math.max(1, ...a.map((d) => d.count), ...(b ?? []).map((d) => d.count));
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: colorA }} />
          {labelA}
        </span>
        {labelB && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: colorB }} />
            {labelB}
          </span>
        )}
      </div>
      <div className="flex h-40 items-end gap-[3px]">
        {a.map((d, i) => {
          const bv = b?.[i]?.count ?? 0;
          return (
            <div key={i} className="group relative flex flex-1 items-end justify-center gap-[2px]" title={`${d.date}`}>
              <div
                className="w-full rounded-t"
                style={{ height: `${(d.count / max) * 100}%`, background: colorA, minHeight: d.count ? 2 : 0 }}
              />
              {b && (
                <div
                  className="w-full rounded-t"
                  style={{ height: `${(bv / max) * 100}%`, background: colorB, minHeight: bv ? 2 : 0 }}
                />
              )}
              <span className="pointer-events-none absolute -top-5 hidden rounded bg-black/80 px-1 text-[10px] group-hover:block">
                {d.count}
                {b ? ` / ${bv}` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>{a[0]?.date}</span>
        <span>{a[a.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function Gauge({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-xl font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await analyticsApi.overview(orgId, days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId, days]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-white/40">Activity across every module, last {days} days.</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                days === d ? 'bg-white/15 font-medium' : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {!data ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : (
        <>
          {/* Totals */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Projects" value={data.totals.projects} />
            <StatCard label="Repositories" value={data.totals.repositories} />
            <StatCard label="Members" value={data.totals.members} />
            <StatCard label="Open issues" value={data.totals.openIssues} />
            <StatCard label="Deployments" value={data.totals.deployments} />
            <StatCard label="Open incidents" value={data.totals.openIncidents} />
          </div>

          {/* Health gauges */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Gauge label="CI pass rate" pct={data.ci.passRate} color="#6d5efc" />
            <Gauge label="Deploy success" pct={data.deployments.successRate} color="#22c55e" />
            <StatCard
              label="Mean time to resolve"
              value={data.incidents.mttrMinutes != null ? `${data.incidents.mttrMinutes}m` : '—'}
              hint={`${data.incidents.total} incident(s) · ${data.monitors.up}/${data.monitors.total} monitors up`}
            />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                Issue throughput
              </h2>
              <BarChart
                a={data.issues.createdSeries}
                b={data.issues.completedSeries}
                labelA="Created"
                labelB="Completed"
              />
            </section>

            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                Deployment frequency
              </h2>
              <BarChart a={data.deployments.series} labelA="Deployments" colorA="#22c55e" />
            </section>
          </div>

          {/* Issue status distribution + top repos */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                Issues by status
              </h2>
              <div className="space-y-2">
                {ISSUE_COLUMNS.map((col) => {
                  const n = data.issues.byStatus[col.status] ?? 0;
                  const total = Object.values(data.issues.byStatus).reduce((a, b) => a + b, 0) || 1;
                  return (
                    <div key={col.status} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-white/50">{col.label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${(n / total) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-white/60">{n}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                Most-deployed repositories
              </h2>
              {data.topRepos.length === 0 ? (
                <p className="text-sm text-white/40">No deployments yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.topRepos.map((r) => {
                    const max = data.topRepos[0].deployments || 1;
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <Link
                          href={`/orgs/${orgId}/repos/${r.id}`}
                          className="w-32 shrink-0 truncate text-white/70 hover:text-white"
                        >
                          {r.name}
                        </Link>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-green-400"
                            style={{ width: `${(r.deployments / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-white/60">{r.deployments}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
