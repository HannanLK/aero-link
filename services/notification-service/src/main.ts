// Tracing must be imported first (side-effect) — see ./tracing.ts
import './tracing';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from '@aerolink/common-middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.setGlobalPrefix('api/v1');
  // ── CORS ─────────────────────────────────────────────────────────────
  // The SPA calls this API cross-origin, so each service answers the OPTIONS
  // preflight and sets the ACAO headers (the API Gateway no longer owns CORS).
  //  - CORS_ORIGINS env (comma-separated) is the allowlist in deployed envs.
  //  - If unset, allow any localhost / 127.0.0.1 port — covers local dev and
  //    `kubectl port-forward` of the running app without baking a prod URL in.
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'Idempotency-Key'],
    maxAge: 3600,
  });


  // ── OpenAPI / Swagger ──────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AeroLink — Notification Service API')
    .setDescription('Transactional email (SES) and SMS (SNS) notifications.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('notifications')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Swagger UI at api/v1/notifications/docs, raw spec at api/v1/notifications/docs/json
  SwaggerModule.setup('api/v1/notifications/docs', app, document, { jsonDocumentUrl: 'api/v1/notifications/docs/json' });

  await app.listen(Number(process.env.PORT ?? 3007), '0.0.0.0');
}

bootstrap();
