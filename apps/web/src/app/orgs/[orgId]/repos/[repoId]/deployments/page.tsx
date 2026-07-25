'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  deployments as deploymentsApi,
  environments as environmentsApi,
  repositories,
  DEPLOY_STATUS_META,
  ENV_TYPE_META,
  shortSha,
  type DeploymentStatus,
  type DeploymentSummary,
  type Environment,
  type Repository,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const m = DEPLOY_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={m.active && status !== 'QUEUED' ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

export default function DeploymentsPage() {
  const ready = useRequireAuth();
  const { orgId, repoId } = useParams<{ orgId: string; repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [deps, setDeps] = useState<DeploymentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, e, d] = await Promise.all([
        repositories.get(orgId, repoId),
        environmentsApi.list(orgId, repoId),
        deploymentsApi.list(orgId, repoId),
      ]);
      setRepo(r);
      setEnvs(e);
      setDeps(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, repoId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // Poll while any deployment is in flight.
  useEffect(() => {
    if (!ready) return;
    const active = deps.some((d) => DEPLOY_STATUS_META[d.status].active);
    if (!active) return;
    const t = setInterval(() => void load(), 1200);
    return () => clearInterval(t);
  }, [ready, deps, load]);

  async function deploy(envId: string) {
    setBusy(envId);
    setError(null);
    try {
      await environmentsApi.deploy(orgId, repoId, envId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setBusy(null);
    }
  }

  async function rollback(env: Environment) {
    // Roll back to the most recent READY deployment that isn't the current one.
    const target = deps.find(
      (d) => d.environment?.id === env.id && d.status === 'READY' && d.id !== env.currentDeployment?.id,
    );
    if (!target) {
      setError('No previous successful deployment to roll back to');
      return;
    }
    setBusy(env.id);
    setError(null);
    try {
      await environmentsApi.rollback(orgId, repoId, env.id, target.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}/repos/${repoId}`} className="text-sm text-white/50 hover:text-white">
        ← {repo?.name ?? 'Repository'}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Deployments</h1>
      <p className="text-sm text-white/40">Environments and their deployment history.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-white/50">Loading…</p>}

      {!loading && (
        <>
          {/* Environments */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {envs.map((env) => {
              const cur = env.currentDeployment;
              return (
                <div key={env.id} className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      {ENV_TYPE_META[env.type].icon} {env.name}
                    </span>
                    {cur && <StatusBadge status={cur.status} />}
                  </div>

                  {cur?.url && cur.status === 'READY' ? (
                    <a
                      href={cur.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block truncate font-mono text-sm text-[var(--color-accent-soft)] hover:underline"
                    >
                      {cur.url} ↗
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-white/30">No live deployment yet.</p>
                  )}

                  {cur && (
                    <p className="mt-1 text-xs text-white/40">
                      #{cur.number} · <span className="font-mono">{cur.branch}</span> ·{' '}
                      <span className="font-mono">{shortSha(cur.commitSha)}</span>
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => deploy(env.id)}
                      disabled={busy === env.id}
                      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === env.id ? 'Working…' : '▸ Deploy'}
                    </button>
                    <button
                      onClick={() => rollback(env)}
                      disabled={busy === env.id}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                      ↩ Rollback
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent deployments */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Recent deployments
            </h2>
            {deps.length === 0 ? (
              <p className="mt-3 text-sm text-white/40">No deployments yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                {deps.map((d, i) => (
                  <Link
                    key={d.id}
                    href={`/orgs/${orgId}/repos/${repoId}/deployments/${d.id}`}
                    className={`flex items-center justify-between px-4 py-3 transition hover:bg-white/5 ${
                      i > 0 ? 'border-t border-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.status} />
                      <span className="text-sm text-white/60">
                        {d.environment?.name}{' '}
                        <span className="font-mono text-white/40">#{d.number}</span>
                      </span>
                      {d.isRollback && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50">
                          rollback
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span className="font-mono">{d.branch}</span>
                      <span className="font-mono">{shortSha(d.commitSha)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
