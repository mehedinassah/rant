import { GithubSyncService } from './github-sync.service';

function setup(orgId: string | null = 'org1') {
  const prisma = { githubInstallation: { update: jest.fn().mockResolvedValue({}) } };
  const api = {
    listInstallationRepos: jest.fn().mockResolvedValue([
      { id: 1, name: 'demo', full_name: 'acme/demo', owner: { login: 'acme' }, private: true, default_branch: 'main' },
    ]),
    listCommits: jest.fn().mockResolvedValue([{ sha: 'a1', commit: { message: 'init' }, author: { login: 'octo' } }]),
    listOpenPulls: jest.fn().mockResolvedValue([{ id: 2, number: 1, title: 'PR', head: { ref: 'f' }, user: { id: 3, login: 'octo' } }]),
    listWorkflowRuns: jest.fn().mockResolvedValue([{ id: 5, name: 'CI', run_number: 1, status: 'completed', conclusion: 'success' }]),
  };
  const ingest = {
    orgIdForInstallation: jest.fn().mockResolvedValue(orgId),
    upsertRepository: jest.fn().mockResolvedValue({ id: 'repo1' }),
    ingestCommits: jest.fn().mockResolvedValue([]),
    upsertPullRequest: jest.fn().mockResolvedValue({ id: 'pr1', number: 1, created: true, isOpen: true }),
    upsertWorkflowRun: jest.fn().mockResolvedValue({ runId: 'r1', pipelineId: 'p1', status: 'SUCCESS', branch: 'main', commitSha: 'a1' }),
  };
  const svc = new GithubSyncService(prisma as never, api as never, ingest as never);
  return { svc, prisma, api, ingest };
}

describe('GithubSyncService', () => {
  it('imports repos, commits, PRs and runs, then marks syncedAt', async () => {
    const { svc, prisma, ingest } = setup();
    const result = await svc.syncInstallation(42);

    expect(result.repos).toBe(1);
    expect(ingest.upsertRepository).toHaveBeenCalledTimes(1);
    expect(ingest.ingestCommits).toHaveBeenCalledTimes(1);
    expect(ingest.upsertPullRequest).toHaveBeenCalledTimes(1);
    expect(ingest.upsertWorkflowRun).toHaveBeenCalledTimes(1);
    expect(prisma.githubInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ syncedAt: expect.any(Date) }) }),
    );
  });

  it('skips when the installation has no active org', async () => {
    const { svc, api, ingest } = setup(null);
    const result = await svc.syncInstallation(42);
    expect(result.repos).toBe(0);
    expect(api.listInstallationRepos).not.toHaveBeenCalled();
    expect(ingest.upsertRepository).not.toHaveBeenCalled();
  });
});
