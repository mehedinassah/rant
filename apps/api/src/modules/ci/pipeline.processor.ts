import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RunStatus } from '@rant/database';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppEvent, PipelineRunCompletedPayload } from '../../common/events/app-events';
import { PIPELINE_QUEUE, PipelineJobData, stepShouldFail } from './ci.constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Background worker that executes a queued pipeline run. Steps are *simulated*
 * (we don't exec real shell commands) — the point is a faithful execution model:
 * jobs run in order, steps within a job run in order, a failing step fails its
 * job and skips the rest, and the run's final status ripples out via an event.
 */
@Processor(PIPELINE_QUEUE, { concurrency: 4 })
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger('PipelineWorker');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  private async isCancelled(runId: string): Promise<boolean> {
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    return !run || run.status === RunStatus.CANCELLED;
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { runId, orgId, repoId } = job.data;
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        pipeline: { select: { name: true } },
        jobs: { orderBy: { orderIdx: 'asc' }, include: { steps: { orderBy: { orderIdx: 'asc' } } } },
      },
    });
    if (!run || run.status !== RunStatus.QUEUED) return;

    this.logger.log(`▶ run ${run.pipeline.name}#${run.number} (${run.jobs.length} jobs)`);
    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: RunStatus.RUNNING, startedAt: new Date() },
    });

    let runFailed = false;

    for (const pjob of run.jobs) {
      if (await this.isCancelled(runId)) return;

      if (runFailed) {
        await this.prisma.pipelineJob.update({ where: { id: pjob.id }, data: { status: RunStatus.SKIPPED } });
        await this.prisma.pipelineStep.updateMany({ where: { jobId: pjob.id }, data: { status: RunStatus.SKIPPED } });
        continue;
      }

      await this.prisma.pipelineJob.update({
        where: { id: pjob.id },
        data: { status: RunStatus.RUNNING, startedAt: new Date() },
      });

      let jobFailed = false;
      for (const step of pjob.steps) {
        if (jobFailed) {
          await this.prisma.pipelineStep.update({ where: { id: step.id }, data: { status: RunStatus.SKIPPED } });
          continue;
        }
        await this.prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: RunStatus.RUNNING, startedAt: new Date(), logs: `$ ${step.command}\n` },
        });
        await sleep(400); // simulate work; lets SSE clients watch progress

        const willFail = stepShouldFail(step.command);
        const logs =
          `$ ${step.command}\n` +
          (willFail
            ? `  ...\n  npm ERR! command failed\n  Error: process exited with code 1\n`
            : `  ...\n  ✓ ${step.name} completed in 0.4s\n`);
        await this.prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: willFail ? RunStatus.FAILED : RunStatus.SUCCESS, finishedAt: new Date(), logs },
        });
        if (willFail) {
          jobFailed = true;
          runFailed = true;
        }
      }

      await this.prisma.pipelineJob.update({
        where: { id: pjob.id },
        data: { status: jobFailed ? RunStatus.FAILED : RunStatus.SUCCESS, finishedAt: new Date() },
      });
    }

    if (await this.isCancelled(runId)) return;

    const status = runFailed ? RunStatus.FAILED : RunStatus.SUCCESS;
    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { status, finishedAt: new Date() },
    });
    this.logger.log(`■ run ${run.pipeline.name}#${run.number} → ${status}`);

    await this.audit.record({
      organizationId: orgId,
      actorId: run.triggeredById,
      action: 'pipeline_run.completed',
      targetType: 'PipelineRun',
      targetId: runId,
      metadata: { pipeline: run.pipeline.name, number: run.number, status },
    });

    const payload: PipelineRunCompletedPayload = {
      orgId,
      repoId,
      runId,
      pipelineId: run.pipelineId,
      status: status as 'SUCCESS' | 'FAILED',
      pullRequestId: run.pullRequestId,
    };
    this.events.emit(AppEvent.PipelineRunCompleted, payload);
  }
}
