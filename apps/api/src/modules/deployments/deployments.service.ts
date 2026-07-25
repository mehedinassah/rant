import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Deployment, Environment } from '@rant/database';
import { DeploymentStatus, EnvironmentType } from '@rant/database';
import { Queue } from 'bullmq';
import { interval, map, Observable, startWith, switchMap, takeWhile } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PipelineRunCompletedPayload } from '../../common/events/app-events';
import { RepositoriesService } from '../repositories/repositories.service';
import { EnvironmentsService } from './environments.service';
import { DEPLOY_QUEUE, DeployJobData } from './deployments.constants';

const DEPLOY_INCLUDE = {
  environment: { select: { id: true, name: true, slug: true, type: true, isProduction: true } },
  triggeredBy: { select: { id: true, name: true, avatarUrl: true } },
};

const TERMINAL: DeploymentStatus[] = [
  DeploymentStatus.READY,
  DeploymentStatus.FAILED,
  DeploymentStatus.CANCELLED,
];

interface DeployOptions {
  branch: string;
  commitSha?: string | null;
  pullRequestId?: string | null;
  triggeredById?: string | null;
  isRollback?: boolean;
}

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
    private readonly environments: EnvironmentsService,
    @InjectQueue(DEPLOY_QUEUE) private readonly queue: Queue<DeployJobData>,
  ) {}

  // ── Creating deployments ──────────────────────────────────

  /** Mints a numbered deployment for an environment and queues it. */
  async createDeployment(orgId: string, repoId: string, env: Environment, opts: DeployOptions) {
    const { deployCounter } = await this.prisma.environment.update({
      where: { id: env.id },
      data: { deployCounter: { increment: 1 } },
      select: { deployCounter: true },
    });

    const deployment = await this.prisma.deployment.create({
      data: {
        environmentId: env.id,
        number: deployCounter,
        branch: opts.branch,
        commitSha: opts.commitSha ?? null,
        pullRequestId: opts.pullRequestId ?? null,
        triggeredById: opts.triggeredById ?? null,
        isRollback: opts.isRollback ?? false,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: opts.triggeredById ?? null,
      action: opts.isRollback ? 'deployment.rollback' : 'deployment.queued',
      targetType: 'Deployment',
      targetId: deployment.id,
      metadata: { environment: env.slug, number: deployment.number, branch: opts.branch },
    });

    await this.queue.add(
      'deploy',
      { deploymentId: deployment.id, orgId, repoId },
      { removeOnComplete: true, removeOnFail: true },
    );

    return deployment;
  }

  /** Manually deploy a branch's current head to an environment. */
  async deployManual(orgId: string, repoId: string, envId: string, actorId: string, branchName?: string) {
    const repo = await this.repos.assertRepo(orgId, repoId);
    const env = await this.environments.assertEnv(orgId, repoId, envId);
    const branch = branchName ?? env.branchFilter ?? repo.defaultBranch;
    const branchRow = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: branch } },
    });
    if (!branchRow) throw new BadRequestException(`Branch "${branch}" does not exist`);

    return this.createDeployment(orgId, repoId, env, {
      branch,
      commitSha: branchRow.headCommitSha,
      triggeredById: actorId,
    });
  }

  /** The ripple: fan a successful CI run out to matching environments. */
  async autoDeployForRun(payload: PipelineRunCompletedPayload): Promise<Deployment[]> {
    const { orgId, repoId, branch, commitSha, pullRequestId } = payload;
    const envs = await this.prisma.environment.findMany({ where: { repositoryId: repoId } });
    const created: Deployment[] = [];

    if (pullRequestId) {
      // A green PR gets preview deployments.
      const previews = envs.filter((e) => e.type === EnvironmentType.PREVIEW);
      for (const env of previews) {
        created.push(
          await this.createDeployment(orgId, repoId, env, { branch, commitSha, pullRequestId }),
        );
      }
    } else {
      // A green push deploys to every environment watching that branch.
      const targets = envs.filter((e) => e.branchFilter === branch && e.type !== EnvironmentType.PREVIEW);
      for (const env of targets) {
        created.push(await this.createDeployment(orgId, repoId, env, { branch, commitSha }));
      }
    }
    return created;
  }

  // ── Rollback ──────────────────────────────────────────────

  async rollback(orgId: string, repoId: string, envId: string, actorId: string, deploymentId: string) {
    const env = await this.environments.assertEnv(orgId, repoId, envId);
    const target = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, environmentId: envId },
    });
    if (!target) throw new NotFoundException('Deployment not found in this environment');
    if (target.status !== DeploymentStatus.READY) {
      throw new BadRequestException('Can only roll back to a previously successful (READY) deployment');
    }
    return this.createDeployment(orgId, repoId, env, {
      branch: target.branch,
      commitSha: target.commitSha,
      triggeredById: actorId,
      isRollback: true,
    });
  }

  // ── Reading ───────────────────────────────────────────────

  async listForRepo(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.deployment.findMany({
      where: { environment: { repositoryId: repoId } },
      include: DEPLOY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findDeployment(orgId: string, repoId: string, deploymentId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, environment: { repositoryId: repoId } },
      include: DEPLOY_INCLUDE,
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  async cancel(orgId: string, repoId: string, deploymentId: string, actorId: string) {
    const deployment = await this.findDeployment(orgId, repoId, deploymentId);
    if (TERMINAL.includes(deployment.status)) {
      throw new BadRequestException(`Deployment is already ${deployment.status.toLowerCase()}`);
    }
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: DeploymentStatus.CANCELLED, finishedAt: new Date() },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'deployment.cancelled',
      targetType: 'Deployment',
      targetId: deploymentId,
    });
    return this.findDeployment(orgId, repoId, deploymentId);
  }

  /** SSE: emit a deployment snapshot every 700ms until it reaches a terminal state. */
  stream(orgId: string, repoId: string, deploymentId: string): Observable<MessageEvent> {
    return interval(700).pipe(
      startWith(0),
      switchMap(() => this.findDeployment(orgId, repoId, deploymentId)),
      takeWhile((d) => !TERMINAL.includes(d.status), true),
      map((d) => ({ data: d }) as MessageEvent),
    );
  }
}
