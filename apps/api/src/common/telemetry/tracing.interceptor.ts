import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';

interface HttpRequest {
  method: string;
  url?: string;
  route?: { path?: string };
}

/**
 * One span per controller handler, on top of the auto-instrumented HTTP and
 * database layers. When OTel is disabled the API tracer is a no-op, so this
 * interceptor costs effectively nothing.
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly tracer = trace.getTracer('rant-api');

  intercept(execContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (execContext.getType() !== 'http') return next.handle();

    const req = execContext.switchToHttp().getRequest<HttpRequest>();
    const controller = execContext.getClass().name;
    const handler = execContext.getHandler().name;

    const span = this.tracer.startSpan(`${controller}.${handler}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.request.method': req.method,
        'http.route': req.route?.path ?? req.url ?? '',
        'code.namespace': controller,
        'code.function': handler,
      },
    });

    const activeContext = trace.setSpan(context.active(), span);
    return context.with(activeContext, () =>
      next.handle().pipe(
        tap({
          next: () => span.setStatus({ code: SpanStatusCode.OK }),
          error: (err: unknown) => {
            span.recordException(err instanceof Error ? err : String(err));
            span.setStatus({ code: SpanStatusCode.ERROR });
          },
        }),
        catchError((err) => throwError(() => err)),
        finalize(() => span.end()),
      ),
    );
  }
}
