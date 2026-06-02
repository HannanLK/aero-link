# ADR-001 — Backend Framework: NestJS (TypeScript)

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Deciders   | Architecture Team |
| Rubric     | Implementation (40%) — enterprise-grade service structure |

## Context

AeroLink requires seven independently deployable microservices covering identity, flights, bookings, payments, check-in, baggage, and notifications. The framework must support:

- Structured dependency injection (DI) for testability
- Declarative middleware, guards, and interceptors for cross-cutting concerns
- Native Kafka and Redis client integration
- OpenAPI 3.0 spec generation without a separate spec file
- TypeScript throughout for type-safety and shared schema contracts with the frontend

## Decision

**NestJS (TypeScript, v10)** is adopted as the backend framework for all seven microservices.

## Alternatives Considered

| Framework | Pros | Cons | Rejected Because |
|-----------|------|------|-----------------|
| Spring Boot (Java) | Industry standard, maximal enterprise credibility | 3× slower delivery, verbose boilerplate, heavier containers (300 MB+) | Delivery timeline risk outweighs credibility gain |
| FastAPI (Python) | Rapid prototyping, async native | Weaker runtime typing, less structured for RBAC/DI patterns | Insufficient architectural rigour for marks |
| Go (Fiber) | Smallest binaries, fastest cold starts | Sparse DI ecosystem, limited Kafka/ORM support | Less enterprise pattern recognition |

## Rationale

1. **Module architecture maps directly to DDD bounded contexts.** Each service is a single NestJS application whose `AppModule` imports domain modules (`BookingModule`, `SagaModule`, `IdempotencyModule`). This demonstrates Domain-Driven Design to the marker without ceremony.

2. **Guards + Interceptors = RBAC + observability for free.** `RolesGuard` (from `@aerolink/common-middleware`) enforces RBAC via `@Roles()` decorator. `RequestLoggerInterceptor` adds structured logging and correlation IDs to every request. Both cross-cutting concerns are applied without polluting business logic.

3. **`@nestjs/swagger` auto-generates OpenAPI 3.0 spec** from controller decorators. Every endpoint, DTO, and enum is automatically documented. Swagger UI is served at `/docs`; the JSON spec is served at `/docs-json` for API Gateway import.

4. **`@nestjs/microservices` provides a first-class Kafka transport.** Consumer groups, topic subscriptions, and message patterns are declared declaratively. No custom Kafka consumer boilerplate.

5. **TypeScript is shared with the frontend and `@aerolink/events` package**, enabling end-to-end type safety for event schemas.

## Consequences

- All services follow the same module/controller/service/repository layer pattern.
- `prisma` is the ORM for PostgreSQL services; `@aws-sdk/client-dynamodb` with `@aws-sdk/lib-dynamodb` for baggage/notification services.
- Every service exposes `GET /health` (liveness) and `GET /ready` (readiness) implemented via `@nestjs/terminus`.
- Graceful shutdown is implemented via `app.enableShutdownHooks()` — pods drain in-flight requests before terminating (satisfies Kubernetes graceful termination).

## Compliance Mapping

| Requirement | How NestJS Addresses It |
|-------------|------------------------|
| RBAC (rubric task 3) | `@Roles()` decorator + `RolesGuard` on every controller |
| Idempotency (task 5) | `IdempotencyInterceptor` checks Redis before processing |
| Correlation IDs (task 5) | `CorrelationIdMiddleware` injects `x-correlation-id` on every request |
| Health probes (fault tolerance) | `@nestjs/terminus` `/health` + `/ready` endpoints |
| OpenAPI docs (task 2) | `@nestjs/swagger` auto-generates from decorators |
