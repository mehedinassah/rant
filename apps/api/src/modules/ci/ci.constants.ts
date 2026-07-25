/** Name of the BullMQ queue that carries pipeline-run execution jobs. */
export const PIPELINE_QUEUE = 'pipeline-runs';

/** Payload put on the queue for the worker. */
export interface PipelineJobData {
  runId: string;
  orgId: string;
  repoId: string;
}

// ── Declarative pipeline config ───────────────────────────────
// Stored as JSON on Pipeline.definition and snapshotted into
// PipelineJob/PipelineStep rows when a run starts.

export interface StepDef {
  name: string;
  run: string;
}

export interface JobDef {
  name: string;
  steps: StepDef[];
}

export interface PipelineDefinition {
  jobs: JobDef[];
}

/** Sensible default config used when a pipeline is created without one. */
export const DEFAULT_DEFINITION: PipelineDefinition = {
  jobs: [
    {
      name: 'build',
      steps: [
        { name: 'checkout', run: 'git checkout $COMMIT_SHA' },
        { name: 'install', run: 'pnpm install --frozen-lockfile' },
        { name: 'build', run: 'pnpm build' },
      ],
    },
    {
      name: 'test',
      steps: [
        { name: 'lint', run: 'pnpm lint' },
        { name: 'test', run: 'pnpm test' },
      ],
    },
  ],
};

/**
 * Deterministic outcome for a simulated step. A step "fails" if its command
 * signals failure — this lets tests build a red pipeline on purpose to prove
 * the merge gate blocks. Real runners would exec the command in a sandbox.
 */
export function stepShouldFail(command: string): boolean {
  const c = command.toLowerCase();
  return c.includes('exit 1') || c.includes('&& false') || c.includes('fail');
}
