import { PipelineTrigger, PullRequestStatus, ReviewState, RunStatus } from '@rant/database';

/** Maps a GitHub pull_request action + flags to rant's PullRequestStatus. */
export function toPullRequestStatus(
  action: string,
  pr: { merged?: boolean; draft?: boolean; state?: string },
): PullRequestStatus {
  if (pr.merged || action === 'merged') return PullRequestStatus.MERGED;
  if (pr.state === 'closed' || action === 'closed') return PullRequestStatus.CLOSED;
  if (pr.draft) return PullRequestStatus.DRAFT;
  return PullRequestStatus.OPEN;
}

/** Maps a GitHub workflow_run conclusion (+ status) to rant's RunStatus. */
export function toRunStatus(conclusion: string | null, status?: string): RunStatus {
  if (status && status !== 'completed') {
    return status === 'in_progress' ? RunStatus.RUNNING : RunStatus.QUEUED;
  }
  switch (conclusion) {
    case 'success':
      return RunStatus.SUCCESS;
    case 'failure':
    case 'timed_out':
      return RunStatus.FAILED;
    case 'cancelled':
      return RunStatus.CANCELLED;
    case 'skipped':
    case 'neutral':
    case 'stale':
    case 'action_required':
      return RunStatus.SKIPPED;
    default:
      return RunStatus.QUEUED;
  }
}

/** Maps a GitHub review state to rant's ReviewState. */
export function toReviewState(state: string): ReviewState {
  switch (state?.toLowerCase()) {
    case 'approved':
      return ReviewState.APPROVED;
    case 'changes_requested':
      return ReviewState.CHANGES_REQUESTED;
    default:
      return ReviewState.COMMENTED;
  }
}

/** Maps a GitHub workflow_run event name to a pipeline trigger. */
export function toPipelineTrigger(event: string | undefined): PipelineTrigger {
  switch (event) {
    case 'push':
      return PipelineTrigger.PUSH;
    case 'pull_request':
    case 'pull_request_target':
      return PipelineTrigger.PULL_REQUEST;
    case 'schedule':
      return PipelineTrigger.SCHEDULE;
    default:
      return PipelineTrigger.MANUAL;
  }
}

/** The two possible bus statuses a completed workflow run maps to. */
export function runStatusForBus(status: RunStatus): 'SUCCESS' | 'FAILED' | 'CANCELLED' {
  if (status === RunStatus.SUCCESS) return 'SUCCESS';
  if (status === RunStatus.CANCELLED) return 'CANCELLED';
  return 'FAILED';
}
