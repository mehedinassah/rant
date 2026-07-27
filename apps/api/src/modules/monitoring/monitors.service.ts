import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus, MonitorStatus } from '@rant/database';
import { interval, map, Observable, startWith, switchMap } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { DEFAULT_CHAOS_SECONDS } from './monitoring.constants';
import { SimulateDto, UpdateMonitorDto } from './dto/monitoring.dto';

interface MetricsSummary {
  samples: number;
  uptimePct: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastStatusCode: number | null;
}

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  /**
   * Ensure every environment in a repo has a monitor row. Monitors are created
   * lazily so the dashboard always lists them; the scheduler only probes those
   * that are active and have a live target URL.
   */
  private async ensureMonitors(repoId: string): Promise<void> {
    const envs = await this.prisma.environment.findMany({
      where: { repositoryId: repoId, monitor: { is: null } },
      include: { currentDeployment: { select: { url: true, status: true } } },
    });
    for (const env of envs) {
      const live = env.currentDeployment?.status === 'READY' ? env.currentDeployment.url : null;
      await this.prisma.monitor.create({
        data: {
          environmentId: env.id,
          name: `${env.name} health`,
          target: live,
          status: live ? MonitorStatus.UP : MonitorStatus.UNKNOWN,
        },
      });
    }
  }

  /** Called from the deploy listener: point the monitor at the new live URL. */
  async syncTargetForEnvironment(environmentId: string, url: string | null): Promise<void> {
    const env = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      select: { name: true },
    });
    if (!env) return;
    await this.prisma.monitor.upsert({
      where: { environmentId },
      create: {
        environmentId,
        name: `${env.name} health`,
        target: url,
        status: url ? MonitorStatus.UP : MonitorStatus.UNKNOWN,
        failCount: 0,
      },
      update: {
        target: url,
        // A fresh deployment clears the failing streak and un-pauses probing.
        status: url ? MonitorStatus.UP : MonitorStatus.UNKNOWN,
        failCount: 0,
        isActive: true,
      },
    });
  }

  async assertMonitor(orgId: string, repoId: string, monitorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, environment: { repositoryId: repoId } },
    });
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  private summarize(
    samples: { up: boolean; latencyMs: number; statusCode: number }[],
  ): MetricsSummary {
    if (samples.length === 0) {
      return { samples: 0, uptimePct: 0, avgLatencyMs: null, lastLatencyMs: null, lastStatusCode: null };
    }
    const ups = samples.filter((s) => s.up);
    const upLatencies = ups.map((s) => s.latencyMs);
    const avg =
      upLatencies.length > 0
        ? Math.round(upLatencies.reduce((a, b) => a + b, 0) / upLatencies.length)
        : null;
    const last = samples[samples.length - 1];
    return {
      samples: samples.length,
      uptimePct: Math.round((ups.length / samples.length) * 1000) / 10,
      avgLatencyMs: avg,
      lastLatencyMs: last.latencyMs,
      lastStatusCode: last.statusCode,
    };
  }

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    await this.ensureMonitors(repoId);

    const monitors = await this.prisma.monitor.findMany({
      where: { environment: { repositoryId: repoId } },
      include: {
        environment: {
          select: { id: true, name: true, slug: true, type: true, isProduction: true },
        },
        _count: {
          select: { incidents: { where: { status: { not: IncidentStatus.RESOLVED } } } },
        },
      },
      orderBy: [{ environment: { isProduction: 'desc' } }, { createdAt: 'asc' }],
    });

    // Attach a 30-minute rollup to each monitor.
    const since = new Date(Date.now() - 30 * 60_000);
    return Promise.all(
      monitors.map(async (m) => {
        const samples = await this.prisma.metricSample.findMany({
          where: { monitorId: m.id, checkedAt: { gte: since } },
          select: { up: true, latencyMs: true, statusCode: true },
          orderBy: { checkedAt: 'asc' },
        });
        return { ...m, summary: this.summarize(samples) };
      }),
    );
  }

  async get(orgId: string, repoId: string, monitorId: string) {
    await this.assertMonitor(orgId, repoId, monitorId);
    return this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        environment: {
          select: { id: true, name: true, slug: true, type: true, isProduction: true },
        },
        _count: {
          select: { incidents: { where: { status: { not: IncidentStatus.RESOLVED } } } },
        },
      },
    });
  }

  /** Time-series samples for charting, plus a rollup summary. */
  async metrics(orgId: string, repoId: string, monitorId: string, minutes = 30) {
    await this.assertMonitor(orgId, repoId, monitorId);
    const since = new Date(Date.now() - minutes * 60_000);
    const samples = await this.prisma.metricSample.findMany({
      where: { monitorId, checkedAt: { gte: since } },
      orderBy: { checkedAt: 'asc' },
      take: 500,
    });
    return { samples, summary: this.summarize(samples) };
  }

  async update(orgId: string, repoId: string, monitorId: string, actorId: string, dto: UpdateMonitorDto) {
    await this.assertMonitor(orgId, repoId, monitorId);
    const monitor = await this.prisma.monitor.update({
      where: { id: monitorId },
      data: {
        name: dto.name,
        intervalSec: dto.intervalSec,
        isActive: dto.isActive,
        // Pausing surfaces as PAUSED; resuming falls back to UNKNOWN until the next probe.
        ...(dto.isActive === false
          ? { status: MonitorStatus.PAUSED }
          : dto.isActive === true
            ? { status: MonitorStatus.UNKNOWN }
            : {}),
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'monitor.updated',
      targetType: 'Monitor',
      targetId: monitorId,
      metadata: { ...dto },
    });
    return monitor;
  }

  /** Inject or clear a simulated outage so the incident flow is demoable. */
  async simulate(orgId: string, repoId: string, monitorId: string, actorId: string, dto: SimulateDto) {
    const monitor = await this.assertMonitor(orgId, repoId, monitorId);
    if (dto.kind === 'outage' && !monitor.target) {
      throw new BadRequestException('Monitor has no live target yet — deploy first');
    }
    const chaosUntil =
      dto.kind === 'outage'
        ? new Date(Date.now() + (dto.durationSec ?? DEFAULT_CHAOS_SECONDS) * 1_000)
        : null;
    await this.prisma.monitor.update({ where: { id: monitorId }, data: { chaosUntil } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: dto.kind === 'outage' ? 'monitor.chaos_injected' : 'monitor.chaos_cleared',
      targetType: 'Monitor',
      targetId: monitorId,
      metadata: { until: chaosUntil },
    });
    return { success: true, chaosUntil };
  }

  /** SSE: push a monitor snapshot (status + recent samples + open incidents) every 2s. */
  stream(orgId: string, repoId: string, monitorId: string): Observable<MessageEvent> {
    return interval(2_000).pipe(
      startWith(0),
      switchMap(async () => {
        const since = new Date(Date.now() - 30 * 60_000);
        const [monitor, samples, incidents] = await Promise.all([
          this.prisma.monitor.findFirst({
            where: { id: monitorId, environment: { repositoryId: repoId } },
            include: {
              environment: { select: { id: true, name: true, slug: true, type: true, isProduction: true } },
            },
          }),
          this.prisma.metricSample.findMany({
            where: { monitorId, checkedAt: { gte: since } },
            orderBy: { checkedAt: 'asc' },
            take: 500,
          }),
          this.prisma.incident.findMany({
            where: { monitorId },
            orderBy: { startedAt: 'desc' },
            take: 10,
          }),
        ]);
        return {
          monitor,
          samples,
          incidents,
          summary: this.summarize(samples),
        };
      }),
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
