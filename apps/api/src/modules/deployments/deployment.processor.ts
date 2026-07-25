import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeploymentStatus } from '@rant/database';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DeployEvent, DeploymentCompletedPayload } from '../../common/events/app-events';
import {
  DEPLOY_QUEUE,
  DeployJobData,
  deployShouldFail,
  deploymentUrl,
} from './deployments.constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Background worker that "builds and releases" a deployment. Like CI, the work
 * is simulated — the value is a faithful lifecycle (QUEUED → BUILDING →
 * DEPLOYING → READY/FAILED), streamed logs, a generated public URL, and the
 * environment's `currentDeployment` pointer atomically advancing on success.
 */
@Processor(DEPLOY_QUEUE, { concurrency: 4 })
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger('DeployWorker');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  private async append(deploymentId: string, line: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE deployments SET logs = logs || ${line + '\n'} WHERE id = ${deploymentId}`;
  }

  private async isCancelled(deploymentId: string): Promise<boolean> {
    const d = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });
    return !d || d.status === DeploymentStatus.CANCELLED;
  }

  async process(job: Job<DeployJobData>): Promise<void> {
    const { deploymentId, orgId, repoId } = job.data;
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        environment: { include: { repository: { select: { slug: true } } } },
      },
    });
    if (!deployment || deployment.status !== DeploymentStatus.QUEUED) return;
    const env = deployment.environment;

    this.logger.log(`▶ deploy ${env.slug}#${deployment.number} (${deployment.branch})`);

    // BUILDING
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: DeploymentStatus.BUILDING, startedAt: new Date() },
    });
    await this.append(deploymentId, `⏳ Building ${deployment.branch} @ ${(deployment.commitSha ?? 'HEAD').slice(0, 7)}`);
    await this.append(deploymentId, '  › installing dependencies');
    await this.append(deploymentId, '  › compiling');
    await sleep(500);
    if (await this.isCancelled(deploymentId)) return;

    const failed = deployShouldFail(deployment.branch);
    if (failed) {
      await this.append(deploymentId, '  ✕ build failed: exited with code 1');
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: DeploymentStatus.FAILED, finishedAt: new Date() },
      });
      await this.finish(orgId, repoId, deploymentId, env.id, DeploymentStatus.FAILED, null, env.slug, deployment.number);
      return;
    }

    // DEPLOYING
    await this.append(deploymentId, '  ✓ build complete');
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: DeploymentStatus.DEPLOYING },
    });
    await this.append(deploymentId, '🚀 Uploading build artifacts');
    await this.append(deploymentId, '  › assigning domain');
    await sleep(500);
    if (await this.isCancelled(deploymentId)) return;

    // READY — generate URL and advance the environment's live pointer.
    const url = deploymentUrl(
      env.repository.slug,
      env.slug,
      env.isProduction,
      deployment.pullRequestId ? `pr-${deployment.number}` : String(deployment.number),
    );
    await this.append(deploymentId, `  ✓ deployed to ${url}`);
    await this.prisma.$transaction([
      this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: DeploymentStatus.READY, url, finishedAt: new Date() },
      }),
      this.prisma.environment.update({
        where: { id: env.id },
        data: { currentDeploymentId: deploymentId },
      }),
    ]);
    this.logger.log(`■ deploy ${env.slug}#${deployment.number} → READY ${url}`);
    await this.finish(orgId, repoId, deploymentId, env.id, DeploymentStatus.READY, url, env.slug, deployment.number);
  }

  private async finish(
    orgId: string,
    repoId: string,
    deploymentId: string,
    environmentId: string,
    status: DeploymentStatus,
    url: string | null,
    envSlug: string,
    number: number,
  ): Promise<void> {
    await this.audit.record({
      organizationId: orgId,
      action: status === DeploymentStatus.READY ? 'deployment.ready' : 'deployment.failed',
      targetType: 'Deployment',
      targetId: deploymentId,
      metadata: { environment: envSlug, number, url },
    });
    const payload: DeploymentCompletedPayload = {
      orgId,
      repoId,
      environmentId,
      deploymentId,
      status: status as 'READY' | 'FAILED',
      url,
    };
    this.events.emit(DeployEvent.Completed, payload);
  }
}
