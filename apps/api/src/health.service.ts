import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from './common/prisma/prisma.service';

export interface DependencyStatus {
  up: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Backs the readiness probe: checks the two hard dependencies (Postgres, Redis)
 * with short timeouts. The Redis client is created lazily and reused.
 */
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger('Health');
  private redis?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async checkDatabase(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { up: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { up: false, error: (err as Error).message };
    }
  }

  async checkRedis(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      const client = this.redisClient();
      const pong = await client.ping();
      return { up: pong === 'PONG', latencyMs: Date.now() - started };
    } catch (err) {
      return { up: false, error: (err as Error).message };
    }
  }

  private redisClient(): Redis {
    if (!this.redis) {
      const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
      this.redis = new Redis(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        // Don't spam reconnects from a health probe.
        retryStrategy: () => null,
      });
      this.redis.on('error', (e) => this.logger.debug(`redis probe error: ${e.message}`));
    }
    return this.redis;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
