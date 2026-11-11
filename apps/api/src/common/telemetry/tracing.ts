/**
 * Opt-in OpenTelemetry bootstrap. This module is imported **first** in main.ts
 * so instrumentation is installed before Nest/Express/HTTP are required.
 *
 * Disabled by default: with `OTEL_ENABLED` unset, this only loads `.env` and
 * returns, and every trace call in the app becomes a no-op. Set
 * `OTEL_ENABLED=true` and point `OTEL_EXPORTER_OTLP_ENDPOINT` at a collector
 * (Jaeger, Tempo, Grafana Agent, Honeycomb, …) to ship traces.
 */
import { join } from 'node:path';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { config as loadEnv } from 'dotenv';

// Match ConfigModule's lookup order so OTEL_* can live in the monorepo .env.
loadEnv({ path: join(process.cwd(), '../../.env') });
loadEnv({ path: join(process.cwd(), '.env') });

let sdk: NodeSDK | undefined;

function startTracing(): void {
  if (process.env.OTEL_ENABLED !== 'true' || sdk) return;

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = new OTLPTraceExporter(
    endpoint ? { url: `${endpoint.replace(/\/$/, '')}/v1/traces` } : undefined,
  );

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'rant-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      'deployment.environment':
        process.env.NODE_ENV ?? process.env.OTEL_ENVIRONMENT ?? 'development',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Too noisy for a web API, and it traces every template/static read.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  // eslint-disable-next-line no-console
  console.log(
    `📊 OpenTelemetry tracing enabled → ${endpoint ?? 'http://localhost:4318/v1/traces'}`,
  );

  const shutdown = () => {
    void sdk?.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startTracing();
