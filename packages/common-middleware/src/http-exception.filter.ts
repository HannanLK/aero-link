import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) ?? 'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message ?? exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        { correlationId, path: request.url, method: request.method, status },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).send({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
