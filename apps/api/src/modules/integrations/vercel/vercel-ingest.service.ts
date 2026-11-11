import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeploymentStatus,
  EnvironmentType,
  IntegrationProvider,
  Prisma,
} from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { DeployEvent, DeploymentCompletedPayload } from '../../../common/events/app-events';
import { NormalizedVercelDeployment } from './vercel.mappers';

/**
 * Writes a real Vercel deployment into rant's existing Deployment/Environment
 * models and emits the same `deployment.completed` event the simulated worker
 * emits. Everything downstream — monitor retargeting, notifications, #activity
 * chat, signed webhooks — reacts without knowing Vercel exists.
 */
@Injectable()
export class VercelIngestService {
  private readonly logger = new Logger('VercelIngest');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async ingestDeployment(input: NormalizedVercelDeployment): Promise<void> {
    const link = await this.prisma.integrationProjectLink.findUnique({
      where: {
        provider_externalProjectId: {
          provider: IntegrationProvider.VERCEL,
          externalProjectId: input.projectId,
        },
      },
      include: {
        repository: {
          select: { id: true, organizationId: true, defaultBranch: true },
        },
      },
    });

    if (!link) {
      this.logger.warn(
        `No repository linked to Vercel project ${input.projectId}; dropping ${input.deploymentId}`,
      );
      return;
    }

    const environment = await this.resolveEnvironment(
      link.environmentId,
      link.repositoryId,
      link.repository.defaultBranch,
    );

    const pullRequestId = input.pullRequestExternalId
      ? (
          await this.prisma.pullRequest.findFirst({
            where: {
              repositoryId: link.repositoryId,
              externalId: input.pullRequestExternalId,
            },
            select: { id: true },
          })
        )?.id ?? null
      : null;

    const deployment = await this.upsertDeployment(
      environment.id,
      input,
      pullRequestId,
      link.repository.defaultBranch,
    );

    await this.audit.record({
      organizationId: link.organizationId,
      action: 'integration.vercel.deployment_synced',
      targetType: 'Deployment',
      targetId: deployment.id,
      metadata: {
        provider: 'vercel',
        externalId: input.deploymentId,
        status: input.state,
        url: input.url,
      },
    });

    if (input.state === 'BUILDING') return;

    // Only a live deployment becomes the environment's current one; failures
    // must not evict whatever is actually serving traffic.
    if (input.state === 'READY') {
      await this.prisma.environment.update({
        where: { id: environment.id },
        data: { currentDeploymentId: deployment.id },
      });
    }

    const payload: DeploymentCompletedPayload = {
      orgId: link.organizationId,
      repoId: link.repositoryId,
      environmentId: environment.id,
      deploymentId: deployment.id,
      status: input.state,
      url: input.url,
    };
    this.events.emit(DeployEvent.Completed, payload);
    this.logger.log(
      `vercel ${input.state.toLowerCase()} ${input.deploymentId} → ${input.url ?? 'no url'} (env ${environment.slug})`,
    );
  }

  private async resolveEnvironment(
    overrideId: string | null,
    repoId: string,
    defaultBranch: string,
  ) {
    if (overrideId) {
      const override = await this.prisma.environment.findFirst({
        where: { id: overrideId, repositoryId: repoId },
      });
      if (override) return override;
      this.logger.warn(`Linked environment ${overrideId} no longer exists; falling back`);
    }

    const existing = await this.prisma.environment.findFirst({
      where: { repositoryId: repoId, type: EnvironmentType.PRODUCTION },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.environment.create({
      data: {
        repositoryId: repoId,
        name: 'Production',
        slug: 'production',
        type: EnvironmentType.PRODUCTION,
        isProduction: true,
        branchFilter: defaultBranch,
      },
    });
  }

  private async upsertDeployment(
    environmentId: string,
    input: NormalizedVercelDeployment,
    pullRequestId: string | null,
    defaultBranch: string,
  ) {
    const terminal = input.state !== 'BUILDING';
    const existing = await this.prisma.deployment.findFirst({
      where: { environmentId, externalId: input.deploymentId },
    });

    if (existing) {
      // Idempotent replay: a terminal deployment already at this state is a no-op.
      if (existing.status === input.state && existing.finishedAt) {
        return existing;
      }
      return this.prisma.deployment.update({
        where: { id: existing.id },
        data: {
          status: input.state as DeploymentStatus,
          branch: input.branch || defaultBranch,
          commitSha: input.commitSha,
          url: input.url,
          pullRequestId,
          finishedAt: terminal ? new Date() : null,
        },
      });
    }

    const { deployCounter } = await this.prisma.environment.update({
      where: { id: environmentId },
      data: { deployCounter: { increment: 1 } },
      select: { deployCounter: true },
    });

    try {
      return await this.prisma.deployment.create({
        data: {
          environmentId,
          number: deployCounter,
          status: input.state as DeploymentStatus,
          branch: input.branch || defaultBranch,
          commitSha: input.commitSha,
          url: input.url,
          pullRequestId,
          source: 'VERCEL',
          externalId: input.deploymentId,
          startedAt: new Date(),
          finishedAt: terminal ? new Date() : null,
        },
      });
    } catch (err) {
      // Two deliveries for the same deployment raced; fall back to the winner.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.deployment.findFirst({
          where: { environmentId, externalId: input.deploymentId },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }
}
