import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType, OrgRole } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AppEvent,
  DeployEvent,
  DeploymentCompletedPayload,
  IncidentOpenedPayload,
  IncidentResolvedPayload,
  MonitorEvent,
  PipelineRunCompletedPayload,
  PullRequestOpenedPayload,
} from '../../common/events/app-events';
import { NotificationsService } from './notifications.service';

const repoPath = (orgId: string, repoId: string) => `/orgs/${orgId}/repos/${repoId}`;

/**
 * Notifications is a pure consumer of the event bus. Everything the other
 * modules emit — a failed CI run, a deploy, an opened/resolved incident, a new
 * pull request — lands here and fans out to the right people's feed. This is
 * the module that makes the whole "ripple" observable to humans.
 */
@Injectable()
export class NotificationsListeners {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(AppEvent.PipelineRunCompleted)
  async onRunCompleted(p: PipelineRunCompletedPayload) {
    if (p.status !== 'FAILED') return; // only surface failures
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: p.runId },
      select: {
        number: true,
        triggeredById: true,
        pipeline: { select: { name: true } },
        pullRequest: { select: { authorId: true } },
      },
    });
    const direct = [run?.triggeredById, run?.pullRequest?.authorId].filter(Boolean) as string[];
    const recipients =
      direct.length > 0
        ? direct
        : await this.notifications.orgMemberIds(p.orgId, [OrgRole.DEVOPS, OrgRole.MANAGER]);

    await this.notifications.notify({
      recipientIds: recipients,
      type: NotificationType.CI_FAILED,
      title: `CI failed on ${p.branch}`,
      body: `${run?.pipeline?.name ?? 'Pipeline'} run #${run?.number ?? ''} failed.`,
      organizationId: p.orgId,
      repositoryId: p.repoId,
      linkPath: `${repoPath(p.orgId, p.repoId)}/runs/${p.runId}`,
      targetType: 'PipelineRun',
      targetId: p.runId,
    });
  }

  @OnEvent(DeployEvent.Completed)
  async onDeploymentCompleted(p: DeploymentCompletedPayload) {
    if (p.status === 'CANCELLED') return;
    const dep = await this.prisma.deployment.findUnique({
      where: { id: p.deploymentId },
      select: {
        number: true,
        triggeredById: true,
        environment: { select: { name: true } },
      },
    });
    const envName = dep?.environment?.name ?? 'an environment';
    const ready = p.status === 'READY';

    const recipients = [
      ...(dep?.triggeredById ? [dep.triggeredById] : []),
      ...(await this.notifications.orgMemberIds(p.orgId, [OrgRole.DEVOPS])),
    ];

    await this.notifications.notify({
      recipientIds: recipients,
      type: ready ? NotificationType.DEPLOYMENT_READY : NotificationType.DEPLOYMENT_FAILED,
      title: ready ? `Deployed to ${envName}` : `Deployment to ${envName} failed`,
      body: ready
        ? p.url
          ? `Live at ${p.url}`
          : `Deployment #${dep?.number ?? ''} is live.`
        : `Deployment #${dep?.number ?? ''} failed to build.`,
      organizationId: p.orgId,
      repositoryId: p.repoId,
      linkPath: `${repoPath(p.orgId, p.repoId)}/deployments/${p.deploymentId}`,
      targetType: 'Deployment',
      targetId: p.deploymentId,
    });
  }

  @OnEvent(MonitorEvent.IncidentOpened)
  async onIncidentOpened(p: IncidentOpenedPayload) {
    const recipients = await this.notifications.orgMemberIds(p.orgId, [
      OrgRole.OWNER,
      OrgRole.ADMIN,
      OrgRole.MANAGER,
      OrgRole.DEVOPS,
    ]);
    await this.notifications.notify({
      recipientIds: recipients,
      type: NotificationType.INCIDENT_OPENED,
      title: `🔴 ${p.severity} incident`,
      body: p.title,
      organizationId: p.orgId,
      repositoryId: p.repoId,
      linkPath: `${repoPath(p.orgId, p.repoId)}/monitoring/${p.monitorId}`,
      targetType: 'Incident',
      targetId: p.incidentId,
    });
  }

  @OnEvent(MonitorEvent.IncidentResolved)
  async onIncidentResolved(p: IncidentResolvedPayload) {
    const recipients = await this.notifications.orgMemberIds(p.orgId, [
      OrgRole.OWNER,
      OrgRole.ADMIN,
      OrgRole.MANAGER,
      OrgRole.DEVOPS,
    ]);
    await this.notifications.notify({
      recipientIds: recipients,
      type: NotificationType.INCIDENT_RESOLVED,
      title: '✅ Incident resolved',
      body: 'The affected environment has recovered.',
      organizationId: p.orgId,
      repositoryId: p.repoId,
      linkPath: `${repoPath(p.orgId, p.repoId)}/monitoring/${p.monitorId}`,
      targetType: 'Incident',
      targetId: p.incidentId,
    });
  }

  @OnEvent(AppEvent.PullRequestOpened)
  async onPullRequestOpened(p: PullRequestOpenedPayload) {
    const recipients = await this.notifications.orgMemberIds(
      p.orgId,
      [OrgRole.MANAGER],
      p.actorId,
    );
    await this.notifications.notify({
      recipientIds: recipients,
      type: NotificationType.PULL_REQUEST_OPENED,
      title: `New pull request #${p.prNumber}`,
      body: `A pull request was opened from ${p.branch}.`,
      organizationId: p.orgId,
      repositoryId: p.repoId,
      linkPath: repoPath(p.orgId, p.repoId),
      targetType: 'PullRequest',
      targetId: p.pullRequestId,
    });
  }
}
