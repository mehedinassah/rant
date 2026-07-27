import { Injectable } from '@nestjs/common';
import {
  DeploymentStatus,
  IncidentStatus,
  IssueStatus,
  MonitorStatus,
  RunStatus,
} from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DayBucket {
  date: string;
  count: number;
}

/** Builds an ordered list of the last `days` days, each initialised to 0. */
function emptyDays(days: number): { key: string; date: string; count: number }[] {
  const out: { key: string; date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ key: d.toISOString().slice(0, 10), date: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 });
  }
  return out;
}

/** Buckets timestamps into per-day counts over the window. */
function bucketByDay(dates: Date[], days: number): DayBucket[] {
  const buckets = emptyDays(days);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    const i = index.get(key);
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets.map((b) => ({ date: b.date, count: b.count }));
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(orgId: string, days = 30) {
    const clampedDays = Math.min(Math.max(days, 7), 90);
    const from = new Date();
    from.setDate(from.getDate() - (clampedDays - 1));
    from.setHours(0, 0, 0, 0);

    const [
      projects,
      repositories,
      members,
      issues,
      deployments,
      runs,
      incidents,
      monitors,
      repoDeployCounts,
    ] = await Promise.all([
      this.prisma.project.count({ where: { workspace: { organizationId: orgId } } }),
      this.prisma.repository.count({ where: { organizationId: orgId } }),
      this.prisma.organizationMembership.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.issue.findMany({
        where: { project: { workspace: { organizationId: orgId } } },
        select: { status: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.deployment.findMany({
        where: { environment: { repository: { organizationId: orgId } } },
        select: { status: true, createdAt: true },
      }),
      this.prisma.pipelineRun.findMany({
        where: { pipeline: { repository: { organizationId: orgId } } },
        select: { status: true },
      }),
      this.prisma.incident.findMany({
        where: { monitor: { environment: { repository: { organizationId: orgId } } } },
        select: { status: true, startedAt: true, resolvedAt: true },
      }),
      this.prisma.monitor.findMany({
        where: { environment: { repository: { organizationId: orgId } }, isActive: true },
        select: { status: true },
      }),
      this.prisma.deployment.groupBy({
        by: ['environmentId'],
        where: { environment: { repository: { organizationId: orgId } } },
        _count: { _all: true },
      }),
    ]);

    // ── Issues ────────────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const s of Object.values(IssueStatus)) byStatus[s] = 0;
    for (const i of issues) byStatus[i.status] += 1;
    const openIssues = issues.filter(
      (i) => i.status !== IssueStatus.DONE && i.status !== IssueStatus.CANCELLED,
    ).length;
    const createdSeries = bucketByDay(
      issues.filter((i) => i.createdAt >= from).map((i) => i.createdAt),
      clampedDays,
    );
    // Approx: a DONE issue is "completed" at its last update.
    const completedSeries = bucketByDay(
      issues.filter((i) => i.status === IssueStatus.DONE && i.updatedAt >= from).map((i) => i.updatedAt),
      clampedDays,
    );

    // ── Deployments ───────────────────────────────────────────
    const deploySeries = bucketByDay(
      deployments.filter((d) => d.createdAt >= from).map((d) => d.createdAt),
      clampedDays,
    );
    const deployReady = deployments.filter((d) => d.status === DeploymentStatus.READY).length;
    const deployFailed = deployments.filter((d) => d.status === DeploymentStatus.FAILED).length;
    const deploySuccessRate =
      deployReady + deployFailed > 0
        ? Math.round((deployReady / (deployReady + deployFailed)) * 1000) / 10
        : 0;

    // ── CI ────────────────────────────────────────────────────
    const ciSuccess = runs.filter((r) => r.status === RunStatus.SUCCESS).length;
    const ciFailed = runs.filter((r) => r.status === RunStatus.FAILED).length;
    const passRate =
      ciSuccess + ciFailed > 0 ? Math.round((ciSuccess / (ciSuccess + ciFailed)) * 1000) / 10 : 0;

    // ── Incidents ─────────────────────────────────────────────
    const resolved = incidents.filter((i) => i.resolvedAt);
    const mttrMinutes =
      resolved.length > 0
        ? Math.round(
            resolved.reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.startedAt.getTime()), 0) /
              resolved.length /
              60_000,
          )
        : null;
    const openIncidents = incidents.filter((i) => i.status !== IncidentStatus.RESOLVED).length;

    // ── Monitors ──────────────────────────────────────────────
    const monitorsUp = monitors.filter((m) => m.status === MonitorStatus.UP).length;

    // ── Top repos by deployment volume ────────────────────────
    const envIds = repoDeployCounts.map((r) => r.environmentId);
    const envs = envIds.length
      ? await this.prisma.environment.findMany({
          where: { id: { in: envIds } },
          select: { id: true, repository: { select: { id: true, name: true } } },
        })
      : [];
    const envToRepo = new Map(envs.map((e) => [e.id, e.repository]));
    const repoTotals = new Map<string, { id: string; name: string; deployments: number }>();
    for (const row of repoDeployCounts) {
      const repo = envToRepo.get(row.environmentId);
      if (!repo) continue;
      const existing = repoTotals.get(repo.id) ?? { id: repo.id, name: repo.name, deployments: 0 };
      existing.deployments += row._count._all;
      repoTotals.set(repo.id, existing);
    }
    const topRepos = [...repoTotals.values()]
      .sort((a, b) => b.deployments - a.deployments)
      .slice(0, 5);

    return {
      range: { days: clampedDays, from: from.toISOString() },
      totals: {
        projects,
        repositories,
        members,
        openIssues,
        deployments: deployments.length,
        openIncidents,
      },
      issues: { byStatus, createdSeries, completedSeries },
      deployments: {
        series: deploySeries,
        total: deployments.length,
        ready: deployReady,
        failed: deployFailed,
        successRate: deploySuccessRate,
      },
      ci: { total: runs.length, success: ciSuccess, failed: ciFailed, passRate },
      incidents: { total: incidents.length, open: openIncidents, mttrMinutes },
      monitors: { total: monitors.length, up: monitorsUp },
      topRepos,
    };
  }
}
