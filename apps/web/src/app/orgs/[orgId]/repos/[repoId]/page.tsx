'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  pipelines as pipelinesApi,
  repositories,
  runs as runsApi,
  RUN_STATUS_META,
  TRIGGER_META,
  shortSha,
  type Pipeline,
  type Repository,
  type RunSummary,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function StatusBadge({ status }: { status: RunSummary['status'] }) {
  const m = RUN_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={status === 'RUNNING' ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

export default function RepoPage() {
  const ready = useRequireAuth();
  const { orgId, repoId } = useParams<{ orgId: string; repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p, rn] = await Promise.all([
        repositories.get(orgId, repoId),
        pipelinesApi.list(orgId, repoId),
        runsApi.list(orgId, repoId),
      ]);
      setRepo(r);
      setPipelines(p);
      setRuns(rn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, repoId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // Poll while any run is active so the list reflects the worker's progress.
  useEffect(() => {
    if (!ready) return;
    const active = runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!active) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [ready, runs, load]);

  async function triggerRun(pipelineId: string) {
    setBusy(pipelineId);
    setError(null);
    try {
      await pipelinesApi.run(orgId, repoId, pipelineId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger run');
    } finally {
      setBusy(null);
    }
  }

  async function createDefaultPipeline() {
    setBusy('new');
    setError(null);
    try {
      await pipelinesApi.create(orgId, repoId, { name: 'ci', triggers: ['PUSH', 'PULL_REQUEST'] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pipeline');
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}/repos`} className="text-sm text-white/50 hover:text-white">
        ← Repositories
      </Link>
      <div className="mt-3 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{repo?.name ?? 'Repository'}</h1>
        <span className="font-mono text-sm text-white/40">{repo?.defaultBranch}</span>
      </div>
      {repo?.project && (
        <p className="text-sm text-white/40">
          linked to project{' '}
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
            {repo.project.key}
          </span>
        </p>
      )}

      <nav className="mt-5 flex gap-2">
        <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium">Pipelines</span>
        <Link
          href={`/orgs/${orgId}/repos/${repoId}/deployments`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          Deployments
        </Link>
        <Link
          href={`/orgs/${orgId}/repos/${repoId}/monitoring`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          Monitoring
        </Link>
      </nav>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-white/50">Loading…</p>}

      {!loading && (
        <>
          {/* Pipelines */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
                Pipelines
              </h2>
              {pipelines.length === 0 && (
                <button
                  onClick={createDefaultPipeline}
                  disabled={busy === 'new'}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
                >
                  + Add CI pipeline
                </button>
              )}
            </div>
            {pipelines.length === 0 ? (
              <p className="mt-3 text-sm text-white/40">
                No pipelines. Add one to run checks on every push and pull request.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {pipelines.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[var(--color-ink-soft)] px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="mt-0.5 flex gap-2 text-xs text-white/40">
                        {p.triggers.map((t) => (
                          <span key={t}>
                            {TRIGGER_META[t].icon} {TRIGGER_META[t].label}
                          </span>
                        ))}
                        <span>· {p._count?.runs ?? 0} runs</span>
                      </div>
                    </div>
                    <button
                      onClick={() => triggerRun(p.id)}
                      disabled={busy === p.id}
                      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === p.id ? 'Starting…' : '▸ Run'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Runs */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Recent runs
            </h2>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-white/40">No runs yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                {runs.map((r, i) => (
                  <Link
                    key={r.id}
                    href={`/orgs/${orgId}/repos/${repoId}/runs/${r.id}`}
                    className={`flex items-center justify-between px-4 py-3 transition hover:bg-white/5 ${
                      i > 0 ? 'border-t border-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={r.status} />
                      <span className="text-sm">
                        <span className="text-white/50">{r.pipeline?.name}</span>{' '}
                        <span className="font-mono text-white/40">#{r.number}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span>
                        {TRIGGER_META[r.trigger].icon} <span className="font-mono">{r.branch}</span>
                      </span>
                      <span className="font-mono">{shortSha(r.commitSha)}</span>
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
