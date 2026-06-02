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

  // ── OpenAPI / Swagger ──────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AeroLink — Identity Service API')
    .setDescription('Authentication, registration, JWT issuance, token refresh, and 9-role RBAC.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Swagger UI at /docs, raw spec at /docs/json
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/json' });

  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

bootstrap();
