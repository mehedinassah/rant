/**
 * Cross-module event contracts. This is the app's internal "ripple" bus:
 * one module emits a domain event, others react — without importing each
 * other (which would create circular module graphs). Today CI listens;
 * tomorrow notifications, deployments and analytics will too.
 */

export const AppEvent = {
  CommitCreated: 'commit.created',
  PullRequestOpened: 'pull_request.opened',
  PipelineRunCompleted: 'pipeline_run.completed',
} as const;

export interface CommitCreatedPayload {
  orgId: string;
  repoId: string;
  branch: string;
  commitSha: string;
  actorId: string;
}

export interface PullRequestOpenedPayload {
  orgId: string;
  repoId: string;
  pullRequestId: string;
  prNumber: number;
  branch: string;
  actorId: string;
}

export interface PipelineRunCompletedPayload {
  orgId: string;
  repoId: string;
  runId: string;
  pipelineId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  branch: string;
  commitSha?: string | null;
  pullRequestId?: string | null;
}

export const DeployEvent = {
  Completed: 'deployment.completed',
} as const;

export interface DeploymentCompletedPayload {
  orgId: string;
  repoId: string;
  environmentId: string;
  deploymentId: string;
  status: 'READY' | 'FAILED' | 'CANCELLED';
  url?: string | null;
}
