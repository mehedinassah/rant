import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GithubProcessor } from './github.processor';
import { AppEvent } from '../../../common/events/app-events';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

describe('GitHub fixtures → ripple', () => {
  it('a recorded failed workflow_run.completed emits PipelineRunCompleted(FAILED)', async () => {
    const ingest = {
      orgIdForInstallation: jest.fn().mockResolvedValue('org1'),
      upsertRepository: jest.fn().mockResolvedValue({ id: 'repo1' }),
      upsertWorkflowRun: jest
        .fn()
        .mockResolvedValue({ runId: 'run1', pipelineId: 'pipe1', status: 'FAILED', branch: 'main', commitSha: 'd34db33f' }),
    };
    const users = { resolveUserId: jest.fn().mockResolvedValue('u1') };
    const events = { emit: jest.fn() };
    const proc = new GithubProcessor(ingest as never, users as never, events as never);

    await proc.process({
      data: { event: 'workflow_run', deliveryId: 'fixture-1', payload: fixture('workflow_run.completed.json') },
    } as never);

    // The installation + repo from the fixture were resolved and mapped…
    expect(ingest.orgIdForInstallation).toHaveBeenCalledWith(55555);
    expect(ingest.upsertRepository).toHaveBeenCalledWith('org1', expect.objectContaining({ id: 987654 }));
    // …and the failure rippled onto the bus for incidents/chat/notifications.
    expect(events.emit).toHaveBeenCalledWith(
      AppEvent.PipelineRunCompleted,
      expect.objectContaining({ orgId: 'org1', repoId: 'repo1', status: 'FAILED' }),
    );
  });
});
