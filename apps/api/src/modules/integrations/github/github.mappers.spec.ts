import {
  toPipelineTrigger,
  toPullRequestStatus,
  toReviewState,
  toRunStatus,
  runStatusForBus,
} from './github.mappers';

describe('github mappers', () => {
  it('maps pull request status', () => {
    expect(toPullRequestStatus('opened', { state: 'open' })).toBe('OPEN');
    expect(toPullRequestStatus('opened', { draft: true, state: 'open' })).toBe('DRAFT');
    expect(toPullRequestStatus('closed', { merged: true })).toBe('MERGED');
    expect(toPullRequestStatus('closed', { merged: false, state: 'closed' })).toBe('CLOSED');
  });

  it('maps workflow run conclusion to run status', () => {
    expect(toRunStatus('success')).toBe('SUCCESS');
    expect(toRunStatus('failure')).toBe('FAILED');
    expect(toRunStatus('timed_out')).toBe('FAILED');
    expect(toRunStatus('cancelled')).toBe('CANCELLED');
    expect(toRunStatus('skipped')).toBe('SKIPPED');
    expect(toRunStatus(null, 'in_progress')).toBe('RUNNING');
    expect(toRunStatus(null, 'queued')).toBe('QUEUED');
  });

  it('maps review state', () => {
    expect(toReviewState('approved')).toBe('APPROVED');
    expect(toReviewState('changes_requested')).toBe('CHANGES_REQUESTED');
    expect(toReviewState('commented')).toBe('COMMENTED');
  });

  it('maps workflow event to pipeline trigger', () => {
    expect(toPipelineTrigger('push')).toBe('PUSH');
    expect(toPipelineTrigger('pull_request')).toBe('PULL_REQUEST');
    expect(toPipelineTrigger('schedule')).toBe('SCHEDULE');
    expect(toPipelineTrigger('workflow_dispatch')).toBe('MANUAL');
  });

  it('collapses run status to the bus enum', () => {
    expect(runStatusForBus('SUCCESS' as never)).toBe('SUCCESS');
    expect(runStatusForBus('CANCELLED' as never)).toBe('CANCELLED');
    expect(runStatusForBus('FAILED' as never)).toBe('FAILED');
    expect(runStatusForBus('SKIPPED' as never)).toBe('FAILED');
  });
});
