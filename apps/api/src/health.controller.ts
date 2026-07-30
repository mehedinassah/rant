import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness: is the process up and serving? No dependency checks — a failing
   * dependency should NOT restart the container (that's what readiness is for).
   */
  @Public()
  @Get()
  live() {
    return { status: 'ok', service: 'rant-api', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness: can we serve traffic? Checks Postgres + Redis. Returns 503 (via
   * ServiceUnavailableException) when a dependency is down so orchestrators/load
   * balancers hold traffic until we recover.
   */
  @Public()
  @Get('ready')
  async ready() {
    const [db, redis] = await Promise.all([
      this.health.checkDatabase(),
      this.health.checkRedis(),
    ]);
    const ready = db.up && redis.up;
    const body = {
      status: ready ? 'ready' : 'not_ready',
      checks: { database: db, redis },
      timestamp: new Date().toISOString(),
    };
    if (!ready) throw new ServiceUnavailableException(body);
    return body;
  }
}
