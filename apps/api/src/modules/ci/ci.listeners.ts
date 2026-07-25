import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PipelineTrigger } from '@rant/database';
import {
  AppEvent,
  CommitCreatedPayload,
  PullRequestOpenedPayload,
} from '../../common/events/app-events';
import { RunsService } from './runs.service';

/**
 * Turns repository events into pipeline runs. This is the trigger half of
 * CI/CD's ripple: a commit or an opened PR here automatically dispatches every
 * pipeline that subscribed to that event — no coupling back to the repo module.
 */
@Injectable()
export class CiListeners {
  private readonly logger = new Logger('CiTriggers');

  constructor(private readonly runs: RunsService) {}

  @OnEvent(AppEvent.CommitCreated)
  async onCommit(payload: CommitCreatedPayload) {
    const started = await this.runs.startRunsForEvent(
      payload.orgId,
      payload.repoId,
      PipelineTrigger.PUSH,
      payload.branch,
      { commitSha: payload.commitSha, triggeredById: payload.actorId },
    );
    if (started.length) {
      this.logger.log(`push → ${started.length} run(s) on ${payload.branch}`);
    }
  }

  @OnEvent(AppEvent.PullRequestOpened)
  async onPullRequest(payload: PullRequestOpenedPayload) {
    const started = await this.runs.startRunsForEvent(
      payload.orgId,
      payload.repoId,
      PipelineTrigger.PULL_REQUEST,
      payload.branch,
      { pullRequestId: payload.pullRequestId, triggeredById: payload.actorId },
    );
    if (started.length) {
      this.logger.log(`PR #${payload.prNumber} → ${started.length} check run(s)`);
    }
  }
}
