'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runs as runsApi,
  streamRun,
  RUN_STATUS_META,
  TRIGGER_META,
  shortSha,
  type RunDetail,
  type RunJob,
  type RunStatus,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

const TERMINAL: RunStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

function StatusBadge({ status, big }: { status: RunStatus; big?: boolean }) {
  const m = RUN_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span className={status === 'RUNNING' ? 'animate-pulse' : ''}>{m.dot}</span>
      {m.label}
    </span>
  );
}

export default function RunPage() {
  const ready = useRequireAuth();
  const { orgId, repoId, runId } = useParams<{ orgId: string; repoId: string; runId: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<string | null>(null);

  // Initial fetch, then subscribe to the live SSE stream until terminal.
  useEffect(() => {
    if (!ready) return;
    let stop: (() => void) | undefined;
    runsApi
      .get(orgId, repoId, runId)
      .then((r) => {
        setRun(r);
        setOpenJob((cur) => cur ?? firstActiveJob(r));
        if (!TERMINAL.includes(r.status)) {
          stop = streamRun(orgId, repoId, runId, (u) => {
            setRun(u);
            setOpenJob((cur) => cur ?? firstActiveJob(u));
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load run'));
    return () => stop?.();
  }, [ready, orgId, repoId, runId]);

  const cancel = useCallback(async () => {
    try {
      const r = await runsApi.cancel(orgId, repoId, runId);
      setRun(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
    }
  }, [orgId, repoId, runId]);

  if (!ready) return null;
  if (error) return <main className="mx-auto max-w-4xl px-6 py-10 text-red-400">{error}</main>;
  if (!run) return <main className="mx-auto max-w-4xl px-6 py-10 text-white/50">Loading…</main>;

  const live = !TERMINAL.includes(run.status);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/orgs/${orgId}/repos/${repoId}`}
        className="text-sm text-white/50 hover:text-white"
      >
        ← {run.pipeline?.name ?? 'Repository'}
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {run.pipeline?.name} <span className="font-mono text-white/40">#{run.number}</span>
          </h1>
          <StatusBadge status={run.status} big />
          {live && <span className="text-xs text-white/40">live</span>}
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

      <div className="mt-2 flex gap-4 text-xs text-white/40">
        <span>
          {TRIGGER_META[run.trigger].icon} {TRIGGER_META[run.trigger].label}
        </span>
        <span className="font-mono">{run.branch}</span>
        <span className="font-mono">{shortSha(run.commitSha)}</span>
        {run.triggeredBy && <span>by {run.triggeredBy.name}</span>}
      </div>

      <div className="mt-8 space-y-3">
        {run.jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            open={openJob === job.id}
            onToggle={() => setOpenJob((cur) => (cur === job.id ? null : job.id))}
          />
        ))}
      </div>
    </main>
  );
}

function firstActiveJob(r: RunDetail): string | null {
  return (
    r.jobs.find((j) => j.status === 'RUNNING' || j.status === 'FAILED')?.id ??
    r.jobs[0]?.id ??
    null
  );
}

function JobCard({
  job,
  open,
  onToggle,
}: {
  job: RunJob;
  open: boolean;
  onToggle: () => void;
}) {
  const m = RUN_STATUS_META[job.status];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--color-ink-soft)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
      >
        <span className="flex items-center gap-2 font-medium">
          <span style={{ color: m.color }} className={job.status === 'RUNNING' ? 'animate-pulse' : ''}>
            {m.dot}
          </span>
          {job.name}
        </span>
        <span className="text-xs text-white/40">{open ? 'hide' : 'show'} logs</span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          {job.steps.map((step) => {
            const sm = RUN_STATUS_META[step.status];
            return (
              <div key={step.id} className="border-b border-white/5 last:border-b-0">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span style={{ color: sm.color }}>{sm.dot}</span>
                    {step.name}
                  </span>
                  <span className="font-mono text-xs text-white/30">{step.command}</span>
                </div>
                {step.logs && (
                  <pre className="overflow-x-auto bg-black/40 px-4 py-2 font-mono text-xs leading-relaxed text-white/70">
                    {step.logs.trimEnd()}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
