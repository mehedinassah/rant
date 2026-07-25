'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  deployments as deploymentsApi,
  streamDeployment,
  DEPLOY_STATUS_META,
  ENV_TYPE_META,
  shortSha,
  type DeploymentDetail,
  type DeploymentStatus,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

const TERMINAL: DeploymentStatus[] = ['READY', 'FAILED', 'CANCELLED'];

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const m = DEPLOY_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={m.active && status !== 'QUEUED' ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

export default function DeploymentPage() {
  const ready = useRequireAuth();
  const { orgId, repoId, deploymentId } = useParams<{
    orgId: string;
    repoId: string;
    deploymentId: string;
  }>();
  const [dep, setDep] = useState<DeploymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let stop: (() => void) | undefined;
    deploymentsApi
      .get(orgId, repoId, deploymentId)
      .then((d) => {
        setDep(d);
        if (!TERMINAL.includes(d.status)) {
          stop = streamDeployment(orgId, repoId, deploymentId, setDep);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    return () => stop?.();
  }, [ready, orgId, repoId, deploymentId]);

  const cancel = useCallback(async () => {
    try {
      setDep(await deploymentsApi.cancel(orgId, repoId, deploymentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
    }
  }, [orgId, repoId, deploymentId]);

  if (!ready) return null;
  if (error) return <main className="mx-auto max-w-4xl px-6 py-10 text-red-400">{error}</main>;
  if (!dep) return <main className="mx-auto max-w-4xl px-6 py-10 text-white/50">Loading…</main>;

  const live = !TERMINAL.includes(dep.status);
  const env = dep.environment;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/orgs/${orgId}/repos/${repoId}/deployments`}
        className="text-sm text-white/50 hover:text-white"
      >
        ← Deployments
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {env && ENV_TYPE_META[env.type].icon} {env?.name}{' '}
            <span className="font-mono text-white/40">#{dep.number}</span>
          </h1>
          <StatusBadge status={dep.status} />
          {dep.isRollback && (
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">rollback</span>
          )}
        </div>
        {live && (
          <button
            onClick={cancel}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/40">
        <span className="font-mono">{dep.branch}</span>
        <span className="font-mono">{shortSha(dep.commitSha)}</span>
        {dep.triggeredBy && <span>by {dep.triggeredBy.name}</span>}
      </div>

      {dep.url && dep.status === 'READY' && (
        <a
          href={dep.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-2 font-mono text-sm text-[var(--color-accent-soft)] hover:bg-[var(--color-accent)]/20"
        >
          {dep.url} ↗
        </a>
      )}

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
          Build logs {live && <span className="ml-2 text-xs font-normal text-white/40">live</span>}
        </h2>
        <pre className="max-h-[28rem] overflow-auto rounded-xl border border-white/10 bg-black/50 px-4 py-3 font-mono text-xs leading-relaxed text-white/75">
          {dep.logs?.trimEnd() || 'Waiting for logs…'}
          {live && <span className="animate-pulse"> ▋</span>}
        </pre>
      </div>
    </main>
  );
}
