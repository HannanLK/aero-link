# AeroLink — Completion Notes

What was added/fixed in this pass, and exactly how to run it.

## 1. Bugs fixed (these previously broke `nest build`)

- **baggage-service** — `baggage.controller.ts` had **two methods named `scan`** (a `@Get` and a `@Post`), which is a TypeScript duplicate-implementation error. The POST handler is renamed **`recordScan`**.
- **payment-service** — `PaymentsController.refund()` called `paymentsService.refund()` with **4 args against a 3-arg signature**, and `ProcessPaymentDto` had **no `class-validator` decorators** (so `ValidationPipe({ whitelist: true })` stripped every field). Fixed: proper `ProcessPaymentDto` / `RefundDto` files with validation + `@ApiProperty`, and `refund(bookingId, idempotencyKey, correlationId, reason?)` now looks up the succeeded charge by booking id.

## 2. Swagger / OpenAPI (rubric Task 2)

- `@nestjs/swagger` added to all 7 HTTP services; `SwaggerModule` wired into each `main.ts`.
- **Swagger UI per service at `/docs`**, raw spec at `/docs/json`.
- `nest-cli.json` added per service to enable the Swagger CLI plugin (auto-documents DTOs from types + class-validator, pulls operation summaries from JSDoc).
- Controllers tagged with `@ApiTags` / `@ApiBearerAuth`.

## 3. Distributed tracing (rubric Task 7)

- Shared `initTracing()` in `@aerolink/common-middleware` (`packages/common-middleware/src/tracing.ts`): OpenTelemetry NodeSDK → OTLP/HTTP → the in-cluster OTel Collector → **AWS X-Ray** (X-Ray id generator + propagator).
- Imported first in every service via `src/tracing.ts` so auto-instrumentation patches http/fastify/kafkajs/pg/aws-sdk.
- Controlled by `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_ENABLED`. No-ops safely if the OTel packages aren't installed.

## 4. Unit tests (rubric Task 8 — was the weakest area)

New specs (mock Prisma / Kafka / Redis / AWS SDK):
- `bookings.service.spec.ts` — saga start, idempotency, ownership, cancellation/compensation
- `payments.service.spec.ts` — charge, PCI last-4, idempotency, refund lookup
- `checkin.service.spec.ts` — boarding-pass issue, duplicate check-in, board FSM, baggage tags
- `baggage.service.spec.ts` — 7-state FSM valid/invalid/terminal transitions
- `notifications.service.spec.ts` — SES/SNS routing + persistence
- `seats.service.spec.ts` — **distributed seat lock** (Redis `SET NX` race, release, cache)
- (plus the existing `auth.service.spec.ts`)

## 5. Load / performance test capture (rubric Task 6)

- `tests/load/run-load-tests.sh` — runs the k6 scenarios, saves `*.summary.json` + console logs to `tests/load/k6-results/<timestamp>/`.
- `tests/load/summarise.mjs` — turns those into a Markdown latency/throughput/error-rate table (`DIGEST.md`) to paste into the report.

## 6. Deployment artifacts

- `infrastructure/deploy.env` — your values (gitignored). **Rotate the AWS + Stripe keys after grading.**
- `infrastructure/deploy.sh` — guided Steps 1–11, **pauses for confirmation before every billed step**. Includes the **Route 53 zone import** so it reuses your existing zone `Z0712947GW3PXCFG0HV` instead of creating a duplicate.
- `infrastructure/load-secrets.sh` — fills Secrets Manager from live Terraform outputs.

---

## How to run

### A. Verify the app locally (do this first)
```bash
# Git Bash / WSL / macOS / Linux
./verify-local.sh
```
This cleans stray build files, `npm install`s (adds Swagger + OTel), generates Prisma clients, builds every service + webui, and runs all unit tests with coverage.

> Note: this had to be delegated to your machine — the sandbox these files were
> authored in is Linux, while your `node_modules` (bcrypt, Prisma engine) are
> Windows-native, and Prisma's Linux engine download was network-blocked there.

### B. Browse the API docs locally
```bash
docker compose up -d
npm run dev
# then open e.g. http://localhost:3003/docs  (booking-service)
```

### C. Deploy to AWS
```bash
cd infrastructure
chmod +x deploy.sh load-secrets.sh
./deploy.sh
```
Resume from a step with `./deploy.sh --from 7`.

### D. Capture performance results (after deploy or against local docker)
```bash
cd tests/load
API_BASE_URL=https://<api>/api/v1 ./run-load-tests.sh all
```

---

## Still outstanding (not code) for top marks
- **Final Report (PDF)** and **Presentation slides** — the two graded deliverables that don't exist yet. I can generate both from this codebase + the captured test/perf results on request.
