import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IncidentSeverity,
  IncidentStatus,
  IssuePriority,
  IssueStatus,
  IssueType,
} from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  IncidentOpenedPayload,
  IncidentResolvedPayload,
  MonitorEvent,
} from '../../common/events/app-events';

/** Shape the scheduler passes in — a monitor joined to its repo/org context. */
export interface MonitorContext {
  id: string;
  name: string;
  environmentId: string;
  environment: {
    id: string;
    name: string;
    isProduction: boolean;
    repository: {
      id: string;
      name: string;
      projectId: string | null;
      organizationId: string;
    };
  };
}

const INCIDENT_INCLUDE = {
  monitor: {
    select: {
      id: true,
      name: true,
      environment: { select: { id: true, name: true, slug: true } },
    },
  },
  issue: { select: { id: true, number: true, title: true, projectId: true } },
};

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger('Incidents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Is there already an unresolved incident for this monitor? */
  private async openIncidentId(monitorId: string): Promise<string | null> {
    const existing = await this.prisma.incident.findFirst({
      where: { monitorId, status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] } },
      select: { id: true },
    });
    return existing?.id ?? null;
  }

  /**
   * Open an incident for a failing monitor (idempotent — no-op if one is
   * already open). Production outages are CRITICAL and ripple a bug issue into
   * the repo's linked project.
   */
  async openIncidentFor(ctx: MonitorContext): Promise<void> {
    if (await this.openIncidentId(ctx.id)) return;

    const repo = ctx.environment.repository;
    const severity = ctx.environment.isProduction
      ? IncidentSeverity.CRITICAL
      : IncidentSeverity.MAJOR;
    const title = `${ctx.environment.name} is down — ${ctx.name}`;
    const summary = `Health checks for ${ctx.name} failed repeatedly. The ${ctx.environment.name} environment is not responding.`;

    // Ripple: a real (non-preview) outage opens a bug on the linked project.
    let issueId: string | null = null;
    if (repo.projectId) {
      issueId = await this.openBugIssue(repo.organizationId, repo.projectId, title, summary, severity);
    }

    const incident = await this.prisma.incident.create({
      data: {
        monitorId: ctx.id,
        status: IncidentStatus.OPEN,
        severity,
        title,
        summary,
        issueId,
      },
    });

    await this.audit.record({
      organizationId: repo.organizationId,
      action: 'incident.opened',
      targetType: 'Incident',
      targetId: incident.id,
      metadata: { monitor: ctx.name, severity, issueId },
    });

    const payload: IncidentOpenedPayload = {
      orgId: repo.organizationId,
      repoId: repo.id,
      environmentId: ctx.environmentId,
      monitorId: ctx.id,
      incidentId: incident.id,
      severity,
      title,
      issueId,
    };
    this.events.emit(MonitorEvent.IncidentOpened, payload);
    this.logger.warn(`⚠ incident opened: ${title}${issueId ? ` (→ issue ${issueId})` : ''}`);
  }

  /** Auto-close the open incident for a monitor that has recovered. */
  async resolveIncidentFor(ctx: MonitorContext): Promise<void> {
    const id = await this.openIncidentId(ctx.id);
    if (!id) return;

    const incident = await this.prisma.incident.update({
      where: { id },
      data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() },
    });

    // If a bug issue was opened for this incident, close it out too.
    if (incident.issueId) {
      await this.prisma.issue
        .update({ where: { id: incident.issueId }, data: { status: IssueStatus.DONE } })
        .catch(() => undefined);
    }

    const repo = ctx.environment.repository;
    await this.audit.record({
      organizationId: repo.organizationId,
      action: 'incident.resolved',
      targetType: 'Incident',
      targetId: incident.id,
      metadata: { monitor: ctx.name },
    });

    const payload: IncidentResolvedPayload = {
      orgId: repo.organizationId,
      repoId: repo.id,
      environmentId: ctx.environmentId,
      monitorId: ctx.id,
      incidentId: incident.id,
    };
    this.events.emit(MonitorEvent.IncidentResolved, payload);
    this.logger.log(`✔ incident resolved: ${ctx.name}`);
  }

  /** Mint a BUG issue on the linked project, reported by the org owner. */
  private async openBugIssue(
    orgId: string,
    projectId: string,
    title: string,
    description: string,
    severity: IncidentSeverity,
  ): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    if (!org) return null;

    try {
      const { issueCounter } = await this.prisma.project.update({
        where: { id: projectId },
        data: { issueCounter: { increment: 1 } },
        select: { issueCounter: true },
      });
      const issue = await this.prisma.issue.create({
        data: {
          projectId,
          number: issueCounter,
          title,
          description,
          type: IssueType.BUG,
          status: IssueStatus.TODO,
          priority:
            severity === IncidentSeverity.CRITICAL ? IssuePriority.URGENT : IssuePriority.HIGH,
          reporterId: org.ownerId,
        },
      });
      return issue.id;
    } catch (err) {
      this.logger.error(`failed to open bug issue for incident: ${String(err)}`);
      return null;
    }
  }

  // ── Read / manage (API) ────────────────────────────────────

  async listForRepo(repoId: string) {
    return this.prisma.incident.findMany({
      where: { monitor: { environment: { repositoryId: repoId } } },
      include: INCIDENT_INCLUDE,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async get(repoId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, monitor: { environment: { repositoryId: repoId } } },
      include: INCIDENT_INCLUDE,
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async acknowledge(orgId: string, repoId: string, incidentId: string, actorId: string) {
    const incident = await this.get(repoId, incidentId);
    if (incident.status !== IncidentStatus.OPEN) {
      throw new BadRequestException(`Incident is already ${incident.status.toLowerCase()}`);
    }
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.ACKNOWLEDGED },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'incident.acknowledged',
      targetType: 'Incident',
      targetId: incidentId,
    });
    return this.get(repoId, incidentId);
  }

  async resolve(orgId: string, repoId: string, incidentId: string, actorId: string) {
    const incident = await this.get(repoId, incidentId);
    if (incident.status === IncidentStatus.RESOLVED) {
      throw new BadRequestException('Incident is already resolved');
    }
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() },
    });
    if (incident.issueId) {
      await this.prisma.issue
        .update({ where: { id: incident.issueId }, data: { status: IssueStatus.DONE } })
        .catch(() => undefined);
    }
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'incident.resolved',
      targetType: 'Incident',
      targetId: incidentId,
      metadata: { manual: true },
    });
    return this.get(repoId, incidentId);
  }
}
