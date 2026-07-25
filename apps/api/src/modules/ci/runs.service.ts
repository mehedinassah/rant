import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Pipeline, PipelineRun } from '@rant/database';
import { PipelineTrigger, RunStatus } from '@rant/database';
import { Queue } from 'bullmq';
import { interval, map, Observable, startWith, switchMap, takeWhile } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { PipelinesService } from './pipelines.service';
import {
  PIPELINE_QUEUE,
  PipelineDefinition,
  PipelineJobData,
} from './ci.constants';

const RUN_DETAIL_INCLUDE = {
  triggeredBy: { select: { id: true, name: true, avatarUrl: true } },
  jobs: {
    orderBy: { orderIdx: 'asc' as const },
    include: { steps: { orderBy: { orderIdx: 'asc' as const } } },
  },
};

const TERMINAL: RunStatus[] = [RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.CANCELLED];

interface RunOptions {
  trigger: PipelineTrigger;
  branch: string;
  commitSha?: string | null;
  pullRequestId?: string | null;
  triggeredById?: string | null;
}

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
    private readonly pipelines: PipelinesService,
    @InjectQueue(PIPELINE_QUEUE) private readonly queue: Queue<PipelineJobData>,
  ) {}

  // ── Creating runs ─────────────────────────────────────────

  /** Snapshots a pipeline's definition into a run + jobs + steps, then queues it. */
  async createRun(orgId: string, repoId: string, pipeline: Pipeline, opts: RunOptions) {
    const { runCounter } = await this.prisma.pipeline.update({
      where: { id: pipeline.id },
      data: { runCounter: { increment: 1 } },
      select: { runCounter: true },
    });

    const def = pipeline.definition as unknown as PipelineDefinition;
    const run = await this.prisma.pipelineRun.create({
      data: {
        pipelineId: pipeline.id,
        number: runCounter,
        trigger: opts.trigger,
        branch: opts.branch,
        commitSha: opts.commitSha ?? null,
        pullRequestId: opts.pullRequestId ?? null,
        triggeredById: opts.triggeredById ?? null,
        jobs: {
          create: def.jobs.map((job, ji) => ({
            name: job.name,
            orderIdx: ji,
            steps: {
              create: job.steps.map((s, si) => ({
                name: s.name,
                command: s.run,
                orderIdx: si,
              })),
            },
          })),
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: opts.triggeredById ?? null,
      action: 'pipeline_run.queued',
      targetType: 'PipelineRun',
      targetId: run.id,
      metadata: { pipeline: pipeline.name, number: run.number, trigger: opts.trigger, branch: opts.branch },
    });

    // Hand off to the background worker.
    await this.queue.add('execute', { runId: run.id, orgId, repoId }, { removeOnComplete: true, removeOnFail: true });

    return run;
  }

  /** Finds every active pipeline subscribed to `trigger` on `branch` and runs each. */
  async startRunsForEvent(
    orgId: string,
    repoId: string,
    trigger: PipelineTrigger,
    branch: string,
    opts: Omit<RunOptions, 'trigger' | 'branch'>,
  ): Promise<PipelineRun[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { repositoryId: repoId, isActive: true },
    });
    const matches = pipelines.filter(
      (p) => p.triggers.includes(trigger) && (!p.branchFilter || p.branchFilter === branch),
    );
    const runs: PipelineRun[] = [];
    for (const p of matches) {
      runs.push(await this.createRun(orgId, repoId, p, { ...opts, trigger, branch }));
    }
    return runs;
  }

  /** Manually dispatch a specific pipeline against a branch's current head. */
  async triggerManual(
    orgId: string,
    repoId: string,
    pipelineId: string,
    actorId: string,
    branchName?: string,
  ) {
    const repo = await this.repos.assertRepo(orgId, repoId);
    const pipeline = await this.pipelines.assertPipeline(orgId, repoId, pipelineId);
    const name = branchName ?? repo.defaultBranch;
    const branch = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name } },
    });
    if (!branch) throw new BadRequestException(`Branch "${name}" does not exist`);

    return this.createRun(orgId, repoId, pipeline, {
      trigger: PipelineTrigger.MANUAL,
      branch: name,
      commitSha: branch.headCommitSha,
      triggeredById: actorId,
    });
  }

  // ── Reading runs ──────────────────────────────────────────

  async listForRepo(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.pipelineRun.findMany({
      where: { pipeline: { repositoryId: repoId } },
      include: {
        pipeline: { select: { id: true, name: true } },
        triggeredBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findRun(orgId: string, repoId: string, runId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id: runId, pipeline: { repositoryId: repoId } },
      include: RUN_DETAIL_INCLUDE,
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async cancel(orgId: string, repoId: string, runId: string, actorId: string) {
    const run = await this.findRun(orgId, repoId, runId);
    if (TERMINAL.includes(run.status)) {
      throw new BadRequestException(`Run is already ${run.status.toLowerCase()}`);
    }
    // Mark run + any non-terminal jobs/steps cancelled. The worker checks this
    // flag between steps and bails out.
    await this.prisma.$transaction([
      this.prisma.pipelineStep.updateMany({
        where: { job: { runId }, status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] } },
        data: { status: RunStatus.CANCELLED },
      }),
      this.prisma.pipelineJob.updateMany({
        where: { runId, status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] } },
        data: { status: RunStatus.CANCELLED },
      }),
      this.prisma.pipelineRun.update({
        where: { id: runId },
        data: { status: RunStatus.CANCELLED, finishedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pipeline_run.cancelled',
      targetType: 'PipelineRun',
      targetId: runId,
    });
    return this.findRun(orgId, repoId, runId);
  }

  // ── Live streaming (SSE) ──────────────────────────────────

  /** Emits a run snapshot every 700ms until the run reaches a terminal state. */
  stream(orgId: string, repoId: string, runId: string): Observable<MessageEvent> {
    return interval(700).pipe(
      startWith(0),
      switchMap(() => this.findRun(orgId, repoId, runId)),
      takeWhile((run) => !TERMINAL.includes(run.status), true),
      map((run) => ({ data: run }) as MessageEvent),
    );
  }
}
