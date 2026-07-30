import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

// Health/readiness probes fire constantly; don't drown the logs in them.
const QUIET_PATHS = new Set(['/api/v1/health', '/api/v1/health/ready']);

/**
 * Structured one-line access log per request: method, path, status, duration.
 * A foundation for real observability (swap the Logger for an OTel span/metric
 * exporter later without touching call sites).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;
    if (QUIET_PATHS.has(originalUrl)) return next.handle();

    const started = Date.now();
    const log = (outcome: string) => {
      const ms = Date.now() - started;
      const line = `${method} ${originalUrl} ${res.statusCode} ${ms}ms`;
      if (res.statusCode >= 500) this.logger.error(`${line} ${outcome}`);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    };

    return next.handle().pipe(
      tap({
        next: () => log('ok'),
        error: (err) => log(err?.message ?? 'error'),
      }),
    );
  }
}
