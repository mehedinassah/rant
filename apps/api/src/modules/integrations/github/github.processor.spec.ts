import { GithubProcessor } from './github.processor';
import { AppEvent } from '../../../common/events/app-events';

function makeProcessor(ingestOverrides: Record<string, unknown> = {}) {
  const ingest = {
    orgIdForInstallation: jest.fn().mockResolvedValue('org1'),
    upsertRepository: jest.fn().mockResolvedValue({ id: 'repo1' }),
    ingestCommits: jest.fn().mockResolvedValue([]),
    upsertPullRequest: jest.fn().mockResolvedValue({ id: 'pr1', number: 7, created: true, isOpen: true }),
    upsertReview: jest.fn().mockResolvedValue(undefined),
    upsertWorkflowRun: jest
      .fn()
      .mockResolvedValue({ runId: 'run1', pipelineId: 'pipe1', status: 'FAILED', branch: 'main', commitSha: 'sha1' }),
    ...ingestOverrides,
  };
  const users = { resolveUserId: jest.fn().mockResolvedValue('user1') };
  const events = { emit: jest.fn() };
  const proc = new GithubProcessor(ingest as never, users as never, events as never);
  return { proc, ingest, users, events };
}

const withRepo = (extra: Record<string, unknown>) => ({
  installation: { id: 999 },
  repository: { id: 111, name: 'demo', private: true, default_branch: 'main' },
  ...extra,
});

describe('GithubProcessor', () => {
  it('THE MONEY TEST: a failed workflow_run ripples PipelineRunCompleted(FAILED)', async () => {
    const { proc, events } = makeProcessor();
    await proc.process({
      data: {
        event: 'workflow_run',
        deliveryId: 'd1',
        payload: withRepo({
          workflow_run: {
            id: 5, name: 'CI', run_number: 12, event: 'push',
            status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'sha1',
          },
        }),
      },
    } as never);

    expect(events.emit).toHaveBeenCalledWith(
      AppEvent.PipelineRunCompleted,
      expect.objectContaining({ orgId: 'org1', repoId: 'repo1', runId: 'run1', status: 'FAILED' }),
    );
  });

  it('does not ripple for an in-progress workflow_run', async () => {
    const { proc, events } = makeProcessor();
    await proc.process({
      data: {
        event: 'workflow_run',
        deliveryId: 'd2',
        payload: withRepo({ workflow_run: { id: 6, status: 'in_progress', run_number: 1 } }),
      },
    } as never);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('emits CommitCreated for each newly stored commit', async () => {
    const { proc, events } = makeProcessor({
      ingestCommits: jest.fn().mockResolvedValue([
        { sha: 'a1', message: 'one' },
        { sha: 'b2', message: 'two' },
      ]),
    });
    await proc.process({
      data: {
        event: 'push',
        deliveryId: 'd3',
        payload: withRepo({ ref: 'refs/heads/main', commits: [{}, {}], sender: { id: 1, login: 'x' } }),
      },
    } as never);
    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith(AppEvent.CommitCreated, expect.objectContaining({ commitSha: 'a1' }));
  });

  it('emits PullRequestOpened only for newly opened PRs', async () => {
    const { proc, events } = makeProcessor();
    await proc.process({
      data: {
        event: 'pull_request',
        deliveryId: 'd4',
        payload: withRepo({ action: 'opened', pull_request: { id: 2, number: 7, title: 'x', head: { ref: 'feat' }, user: { id: 3, login: 'y' } } }),
      },
    } as never);
    expect(events.emit).toHaveBeenCalledWith(
      AppEvent.PullRequestOpened,
      expect.objectContaining({ pullRequestId: 'pr1', prNumber: 7 }),
    );
  });

  it('drops events for installations with no linked org', async () => {
    const { proc, events } = makeProcessor({ orgIdForInstallation: jest.fn().mockResolvedValue(null) });
    await proc.process({
      data: { event: 'push', deliveryId: 'd5', payload: withRepo({ ref: 'refs/heads/main', commits: [{}] }) },
    } as never);
    expect(events.emit).not.toHaveBeenCalled();
  });
});
