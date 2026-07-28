import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import {
  AppEvent,
  CommitCreatedPayload,
  PipelineRunCompletedPayload,
  PullRequestOpenedPayload,
} from '../../../common/events/app-events';
import { GITHUB_EVENTS_QUEUE } from './github.constants';
import { GithubIngestService } from './github-ingest.service';
import { GithubUserMapper } from './github-user.mapper';
import { runStatusForBus } from './github.mappers';
import type { GithubJobData } from './github-webhook.controller';

type Payload = Record<string, any>;

/**
 * Consumes verified GitHub webhook deliveries and maps them onto rant's models
 * via the ingest service, then **emits the existing domain events** so the whole
 * ripple (incidents, chat #activity, notifications, copilot) fires on real
 * GitHub data with zero changes downstream. This is the wedge.
 */
@Processor(GITHUB_EVENTS_QUEUE, { concurrency: 4 })
export class GithubProcessor extends WorkerHost {
  private readonly logger = new Logger('GithubWorker');

  constructor(
    private readonly ingest: GithubIngestService,
    private readonly users: GithubUserMapper,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<GithubJobData>): Promise<void> {
    const { event, payload } = job.data;
    switch (event) {
      case 'push':
        return this.onPush(payload);
      case 'pull_request':
        return this.onPullRequest(payload);
      case 'pull_request_review':
        return this.onReview(payload);
      case 'workflow_run':
        return this.onWorkflowRun(payload);
      default:
        this.logger.debug(`Ignoring unhandled event: ${event}`);
    }
  }

  private async resolve(payload: Payload): Promise<{ orgId: string; repoId: string } | null> {
    const installationId = payload?.installation?.id;
    const repo = payload?.repository;
    if (!installationId || !repo) return null;
    const orgId = await this.ingest.orgIdForInstallation(installationId);
    if (!orgId) {
      this.logger.warn(`No org for installation ${installationId}; dropping event`);
      return null;
    }
    const { id: repoId } = await this.ingest.upsertRepository(orgId, repo);
    return { orgId, repoId };
  }

  private async onPush(payload: Payload): Promise<void> {
    const ctx = await this.resolve(payload);
    if (!ctx) return;
    const branch = String(payload.ref ?? '').replace('refs/heads/', '') || 'main';
    const created = await this.ingest.ingestCommits(ctx.repoId, branch, payload.commits ?? []);
    const actorId = await this.users.resolveUserId(payload.sender);
    for (const c of created) {
      this.events.emit(AppEvent.CommitCreated, {
        orgId: ctx.orgId,
        repoId: ctx.repoId,
        branch,
        commitSha: c.sha,
        actorId,
      } satisfies CommitCreatedPayload);
    }
  }

  private async onPullRequest(payload: Payload): Promise<void> {
    const ctx = await this.resolve(payload);
    if (!ctx) return;
    const action = String(payload.action ?? '');
    const pr = payload.pull_request;
    if (!pr) return;
    const result = await this.ingest.upsertPullRequest(ctx.repoId, action, pr);
    if (result.created && result.isOpen) {
      const actorId = await this.users.resolveUserId(pr.user);
      this.events.emit(AppEvent.PullRequestOpened, {
        orgId: ctx.orgId,
        repoId: ctx.repoId,
        pullRequestId: result.id,
        prNumber: result.number,
        branch: pr.head?.ref ?? 'unknown',
        actorId,
      } satisfies PullRequestOpenedPayload);
    }
  }

  private async onReview(payload: Payload): Promise<void> {
    const ctx = await this.resolve(payload);
    if (!ctx) return;
    const pr = payload.pull_request;
    const review = payload.review;
    if (!pr || !review) return;
    const result = await this.ingest.upsertPullRequest(ctx.repoId, 'reviewed', pr);
    await this.ingest.upsertReview(result.id, review);
  }

  private async onWorkflowRun(payload: Payload): Promise<void> {
    const ctx = await this.resolve(payload);
    if (!ctx) return;
    const run = payload.workflow_run;
    if (!run || run.status !== 'completed') return; // only ripple on completion
    const result = await this.ingest.upsertWorkflowRun(ctx.repoId, run);
    this.events.emit(AppEvent.PipelineRunCompleted, {
      orgId: ctx.orgId,
      repoId: ctx.repoId,
      runId: result.runId,
      pipelineId: result.pipelineId,
      status: runStatusForBus(result.status as never),
      branch: result.branch,
      commitSha: result.commitSha,
      pullRequestId: null,
    } satisfies PipelineRunCompletedPayload);
  }
}
