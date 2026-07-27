import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IncidentsService, MonitorContext } from './incidents.service';
import {
  HEALTH_TICK_MS,
  INCIDENT_OPEN_THRESHOLD,
  SAMPLE_RETENTION_MS,
  simulateCheck,
} from './monitoring.constants';

/**
 * The monitoring worker. Unlike CI/Deploy (one-shot BullMQ jobs), health checks
 * are periodic, so this runs an in-process tick every few seconds: probe every
 * active monitor that has a live target, record a time-series sample, update
 * status, and open/resolve incidents as health changes. This is the "observe"
 * stage that closes the plan → build → ship → observe loop.
 */
@Injectable()
export class MonitoringScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MonitorWorker');
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), HEALTH_TICK_MS);
    this.logger.log(`health checks every ${HEALTH_TICK_MS / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return; // never let ticks overlap
    this.ticking = true;
    try {
      const monitors = await this.prisma.monitor.findMany({
        where: { isActive: true, target: { not: null } },
        include: {
          environment: {
            select: {
              id: true,
              name: true,
              isProduction: true,
              repository: {
                select: { id: true, name: true, projectId: true, organizationId: true },
              },
            },
          },
        },
      });

      const now = Date.now();
      for (const m of monitors) {
        const chaosActive = m.chaosUntil ? m.chaosUntil.getTime() > now : false;
        const result = simulateCheck(chaosActive);
        const failCount = result.up ? 0 : m.failCount + 1;

        await this.prisma.$transaction([
          this.prisma.metricSample.create({
            data: {
              monitorId: m.id,
              status: result.status,
              latencyMs: result.latencyMs,
              statusCode: result.statusCode,
              up: result.up,
            },
          }),
          this.prisma.monitor.update({
            where: { id: m.id },
            data: { status: result.status, lastCheckedAt: new Date(), failCount },
          }),
        ]);

        const ctx: MonitorContext = {
          id: m.id,
          name: m.name,
          environmentId: m.environmentId,
          environment: {
            id: m.environment.id,
            name: m.environment.name,
            isProduction: m.environment.isProduction,
            repository: m.environment.repository,
          },
        };

        if (!result.up && failCount >= INCIDENT_OPEN_THRESHOLD) {
          await this.incidents.openIncidentFor(ctx);
        } else if (result.up) {
          await this.incidents.resolveIncidentFor(ctx);
        }
      }

      // Bound growth: drop samples older than the retention window.
      await this.prisma.metricSample.deleteMany({
        where: { checkedAt: { lt: new Date(now - SAMPLE_RETENTION_MS) } },
      });
    } catch (err) {
      this.logger.error(`tick failed: ${String(err)}`);
    } finally {
      this.ticking = false;
    }
  }
}
