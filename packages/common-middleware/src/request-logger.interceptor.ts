import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const correlationId = req.headers[CORRELATION_ID_HEADER];
    const userId = req.headers['x-user-id'];
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log({
            correlationId,
            userId,
            method,
            path: url,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          });
        },
        error: () => {
          this.logger.warn({
            correlationId,
            userId,
            method,
            path: url,
            durationMs: Date.now() - start,
          });
        },
      }),
    );
  }
}
