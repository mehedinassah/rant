import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';

// Isolate the e2e BullMQ queues from a developer's running dev stack on the
// same Redis instance. CI can override with E2E_REDIS_URL.
process.env.REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/1';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  /** Base origin, e.g. http://127.0.0.1:54321 */
  origin: string;
  http: ReturnType<INestApplication['getHttpServer']>;
}

/**
 * Boots the real AppModule (same HTTP pipeline as main.ts) on an ephemeral port.
 * Requires a disposable DATABASE_URL and a reachable Redis.
 */
export async function createTestApp(): Promise<TestContext> {
  // Set before the module reads ConfigService. dotenv never overrides existing
  // process env, so these win over the developer's .env.
  process.env.JWT_ACCESS_SECRET ||= 'e2e-access-secret';
  process.env.JWT_REFRESH_SECRET ||= 'e2e-refresh-secret';
  process.env.VERCEL_WEBHOOK_SECRET ||= 'e2e-vercel-secret';
  process.env.FEATURE_VERCEL ||= 'true';
  process.env.SENTRY_WEBHOOK_SECRET ||= 'e2e-sentry-secret';
  process.env.FEATURE_SENTRY ||= 'true';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, cors: true });
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    prisma: app.get(PrismaService),
    origin: `http://127.0.0.1:${address.port}`,
    http: app.getHttpServer(),
  };
}

/**
 * Wipes every domain table. TRUNCATE ... CASCADE follows the org/user foreign
 * keys, so this is a single round-trip instead of a hand-maintained delete order.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
       "storage_blobs",
       "audit_logs",
       "github_webhook_deliveries",
       "integration_webhook_deliveries",
       "users",
       "organizations"
     RESTART IDENTITY CASCADE`,
  );
}

/** Poll an async read until `done` is true (or fail with the last value). */
export async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  label: string,
  timeoutMs = 20_000,
  intervalMs = 200,
): Promise<T> {
  const startedAt = Date.now();
  let value = await read();
  while (!done(value)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    value = await read();
  }
  return value;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Vercel signs the raw body with HMAC-SHA1 and a lowercase hex digest. */
export function vercelSignature(rawBody: string, secret = process.env.VERCEL_WEBHOOK_SECRET!): string {
  return createHmac('sha1', secret).update(rawBody).digest('hex');
}

/** Sentry signs the raw body with HMAC-SHA256 and a lowercase hex digest. */
export function sentrySignature(rawBody: string, secret = process.env.SENTRY_WEBHOOK_SECRET!): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
