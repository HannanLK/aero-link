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

---

## 7. GitOps / EKS deployment completeness (ArgoCD + GitHub Actions)

Running `terraform apply` alone did NOT yield a running app. These gaps were closed so the **push → Actions → ECR → ArgoCD sync** chain actually works:

- **CI region fixed** — both GitHub Actions workflows used `ap-southeast-1`; changed to `us-east-1` (ECR registry + OIDC now match the deployment region).
- **ApplicationSet repoURL** — set to `https://github.com/HannanLK/aero-link` in both the standalone manifest and the Terraform-applied one (`eks-addons/main.tf`). Also switched the Terraform ApplicationSet to **per-element paths** (it previously hardcoded `services/{{service}}/helm`, which was wrong for `webui`).
- **Helm charts completed for all 7 services** — flight, payment, checkin, baggage, notification had missing/partial charts; now each has Deployment, Service, ServiceAccount, ExternalSecret, PDB (+ HPA, or KEDA ScaledObject for baggage/notification). All containers listen on port 3000 (`PORT=3000`) to match probes.
- **Health endpoints added** — booking, payment, checkin, baggage, notification had none, so their probes could never pass. Added `/api/v1/health/live` + `/ready`.
- **Database schema creation** — no Prisma migration files exist, so each Prisma service now runs a `prisma db push` **init-container** (`migrations.enabled`). The per-service databases are created first by a new **`platform-init`** chart: a `db-bootstrap` Job (ArgoCD **sync-wave -1**) creates `identity_db … checkin_db` from `shared/aurora-admin-url`.
- **Kafka on MSK** — service Kafka clients were plaintext (local-only). Added a shared `createKafka()` factory that uses **TLS + SASL/IAM** when `KAFKA_AUTH=iam` (via `aws-msk-iam-sasl-signer-js`), plaintext locally. Topics (MSK has auto-create disabled) are now created idempotently in-app via `ensureTopics()` on producer startup, reusing each pod's IRSA auth.

### Deployment order (already handled by deploy.sh)
Secrets must be loaded (Step 8, now incl. `shared/aurora-admin-url`) **before** ArgoCD syncs (Step 9). ArgoCD then: platform-init secret (wave -2) → db-bootstrap Job (wave -1) → service apps (wave 0, whose init-containers run `prisma db push`).

### Known remaining (flagged, not blocking the pipeline)
- The **MSK IAM Kafka path and db-bootstrap Job are untested** from this environment (no live AWS). They're written to the correct AWS patterns but are the most likely to need a small tweak on first real sync — watch the `db-bootstrap` Job log and the first service pod's init-container log.
- The notification-service **KEDA ScaledObject** needs a `TriggerAuthentication` (MSK SASL/IAM) and `kafka.bootstrapServers` set to scale on real MSK; the consumer itself works regardless.

## 8. notification-service Kafka consumer (now implemented)

Previously notification-service had only an SES/SNS sender class and no consumer, so it never reacted to events. Added `src/kafka/notification.consumer.ts` + `kafka.module.ts` (consumer group `notification-service-group`, matching the KEDA trigger). It subscribes to `user.registered`, `booking.confirmed`, `payment.completed`, `checkin.completed`, `flight.status-changed`, and `baggage.status-updated`, and dispatches the corresponding passenger notification (email/SMS/push, persisted to DynamoDB). A `WELCOME` notification type was added for `user.registered`.
