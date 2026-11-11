import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EnvironmentType,
  IncidentStatus,
  IntegrationProvider,
  IssueStatus,
  MonitorStatus,
} from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { IncidentsService } from '../../monitoring/incidents.service';
import {
  IncidentOpenedPayload,
  IncidentResolvedPayload,
  MonitorEvent,
} from '../../../common/events/app-events';
import { NormalizedSentryIssue } from './sentry.mappers';

/**
 * Writes real Sentry issues into rant's Incident model and emits the existing
 * `incident.opened` / `incident.resolved` events. The ripple is unchanged: docs
 * drafts a postmortem, notifications fan out, #activity posts, webhooks fire.
 */
@Injectable()
export class SentryIngestService {
  private readonly logger = new Logger('SentryIngest');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly incidents: IncidentsService,
    private readonly events: EventEmitter2,
  ) {}

  async ingestIssue(input: NormalizedSentryIssue): Promise<void> {
    const link = await this.prisma.integrationProjectLink.findUnique({
      where: {
        provider_externalProjectId: {
          provider: IntegrationProvider.SENTRY,
          externalProjectId: input.projectId,
        },
      },
      include: {
        repository: {
          select: { id: true, organizationId: true, projectId: true, defaultBranch: true },
        },
      },
    });

    if (!link) {
      this.logger.warn(
        `No repository linked to Sentry project ${input.projectId}; dropping issue ${input.issueId}`,
      );
      return;
    }

    const environment = await this.resolveEnvironment(
      link.environmentId,
      link.repositoryId,
      link.repository.defaultBranch,
    );
    const monitor = await this.ensureMonitor(environment.id, environment.name, environment.liveUrl);

    if (input.action === 'open') {
      await this.openIncident(link, environment.id, monitor.id, input);
    } else {
      await this.resolveIncident(link, environment.id, monitor.id, input);
    }
  }

  private async openIncident(
    link: LinkContext,
    environmentId: string,
    monitorId: string,
    input: NormalizedSentryIssue,
  ): Promise<void> {
    const repo = link.repository;
    const summary =
      [input.culprit, input.permalink].filter(Boolean).join(' — ') || null;

    const existing = await this.prisma.incident.findFirst({
      where: { monitorId, externalId: input.issueId },
    });

    if (existing && existing.status !== IncidentStatus.RESOLVED) {
      return; // already tracking this Sentry issue
    }

    let incidentId: string;
    let issueId: string | null;

    if (existing) {
      // Sentry re-opened a previously resolved issue.
      const reopened = await this.prisma.incident.update({
        where: { id: existing.id },
        data: {
          status: IncidentStatus.OPEN,
          severity: input.severity,
          title: input.title,
          summary,
          resolvedAt: null,
          startedAt: input.firstSeen ?? new Date(),
        },
      });
      incidentId = reopened.id;
      issueId = reopened.issueId;
      if (issueId) {
        await this.prisma.issue
          .update({ where: { id: issueId }, data: { status: IssueStatus.TODO } })
          .catch(() => undefined);
      }
    } else {
      issueId = repo.projectId
        ? await this.incidents.fileBugIssue(
            repo.organizationId,
            repo.projectId,
            input.title,
            summary ?? `Sentry issue ${input.issueId}`,
            input.severity,
          )
        : null;

      const created = await this.prisma.incident.create({
        data: {
          monitorId,
          status: IncidentStatus.OPEN,
          severity: input.severity,
          title: input.title,
          summary,
          issueId,
          source: 'SENTRY',
          externalId: input.issueId,
          startedAt: input.firstSeen ?? new Date(),
        },
      });
      incidentId = created.id;
    }

    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { status: MonitorStatus.DOWN },
    });

    await this.audit.record({
      organizationId: repo.organizationId,
      action: 'integration.sentry.incident_opened',
      targetType: 'Incident',
      targetId: incidentId,
      metadata: {
        provider: 'sentry',
        externalId: input.issueId,
        level: input.level,
        severity: input.severity,
        permalink: input.permalink,
      },
    });

    const payload: IncidentOpenedPayload = {
      orgId: repo.organizationId,
      repoId: repo.id,
      environmentId,
      monitorId,
      incidentId,
      severity: input.severity,
      title: input.title,
      issueId,
    };
    this.events.emit(MonitorEvent.IncidentOpened, payload);
    this.logger.warn(
      `Sentry issue ${input.issueId} opened (${input.severity})${issueId ? ` → issue ${issueId}` : ''}`,
    );
  }

  private async resolveIncident(
    link: LinkContext,
    environmentId: string,
    monitorId: string,
    input: NormalizedSentryIssue,
  ): Promise<void> {
    const repo = link.repository;
    const incident = await this.prisma.incident.findFirst({
      where: { monitorId, externalId: input.issueId },
    });
    if (!incident || incident.status === IncidentStatus.RESOLVED) return;

    await this.prisma.incident.update({
      where: { id: incident.id },
      data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() },
    });
    if (incident.issueId) {
      await this.prisma.issue
        .update({ where: { id: incident.issueId }, data: { status: IssueStatus.DONE } })
        .catch(() => undefined);
    }

    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { status: MonitorStatus.UP, failCount: 0 },
    });

    await this.audit.record({
      organizationId: repo.organizationId,
      action: 'integration.sentry.incident_resolved',
      targetType: 'Incident',
      targetId: incident.id,
      metadata: { provider: 'sentry', externalId: input.issueId },
    });

    const payload: IncidentResolvedPayload = {
      orgId: repo.organizationId,
      repoId: repo.id,
      environmentId,
      monitorId,
      incidentId: incident.id,
    };
    this.events.emit(MonitorEvent.IncidentResolved, payload);
    this.logger.log(`Sentry issue ${input.issueId} resolved`);
  }

  private async resolveEnvironment(
    overrideId: string | null,
    repoId: string,
    defaultBranch: string,
  ): Promise<{ id: string; name: string; liveUrl: string | null }> {
    const include = { currentDeployment: { select: { url: true, status: true } } } as const;

    if (overrideId) {
      const override = await this.prisma.environment.findFirst({
        where: { id: overrideId, repositoryId: repoId },
        include,
      });
      if (override) {
        return {
          id: override.id,
          name: override.name,
          liveUrl: override.currentDeployment?.status === 'READY' ? override.currentDeployment.url : null,
        };
      }
      this.logger.warn(`Linked environment ${overrideId} no longer exists; falling back`);
    }

    const existing = await this.prisma.environment.findFirst({
      where: { repositoryId: repoId, type: EnvironmentType.PRODUCTION },
      orderBy: { createdAt: 'asc' },
      include,
    });
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        liveUrl: existing.currentDeployment?.status === 'READY' ? existing.currentDeployment.url : null,
      };
    }

    const created = await this.prisma.environment.create({
      data: {
        repositoryId: repoId,
        name: 'Production',
        slug: 'production',
        type: EnvironmentType.PRODUCTION,
        isProduction: true,
        branchFilter: defaultBranch,
      },
    });
    return { id: created.id, name: created.name, liveUrl: null };
  }

  private async ensureMonitor(environmentId: string, environmentName: string, liveUrl: string | null) {
    const existing = await this.prisma.monitor.findUnique({ where: { environmentId } });
    if (existing) return existing;
    return this.prisma.monitor.create({
      data: {
        environmentId,
        name: `${environmentName} health`,
        target: liveUrl,
        status: liveUrl ? MonitorStatus.UP : MonitorStatus.UNKNOWN,
      },
    });
  }
}

interface LinkContext {
  organizationId: string;
  environmentId: string | null;
  repositoryId: string;
  repository: {
    id: string;
    organizationId: string;
    projectId: string | null;
    defaultBranch: string;
  };
}
