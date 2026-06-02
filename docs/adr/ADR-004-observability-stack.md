# ADR-004 — Observability Stack: CloudWatch + X-Ray + Elastic APM

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Deciders   | Architecture Team |
| Rubric     | Task 7 — Monitoring and Observability (CloudWatch explicitly named) |

## Context

The system must provide distributed tracing across the booking saga, structured logs per service, custom metrics (booking rate, seat availability, payment latency), and dashboards. The rubric explicitly names AWS CloudWatch as a required tool. The project hard constraint requires Elastic APM or an equivalent with a justified trade-off.

## Decision

**Three-tier observability stack:**

| Tier | Tool | Responsibility |
|------|------|----------------|
| Logs | CloudWatch Logs | Structured JSON logs from all pods via Fluent Bit DaemonSet |
| Metrics | CloudWatch Metrics + Prometheus (in-cluster) | Custom app metrics + K8s node/pod metrics |
| Traces | AWS X-Ray | Distributed trace propagation across service calls and Kafka events |
| APM | Elastic APM (free 14-day trial) | Code-level profiling, transaction dashboards, error tracking |

## Alternatives Considered

| Stack | Pros | Cons | Decision |
|-------|------|------|----------|
| **CloudWatch + X-Ray + Elastic APM (chosen)** | CloudWatch satisfies rubric requirement; X-Ray native AWS trace propagation; Elastic APM satisfies hard constraint | Two systems to manage | Accepted |
| Full ELK Stack (self-hosted) | Single pane of glass | EC2 Elasticsearch = $0.10+/hr additional cost | Rejected (cost) |
| Datadog | Best-in-class UX, full APM | $15–18/host/month = unacceptable | Rejected (cost) |
| CloudWatch + X-Ray only | Zero extra cost, fully native | Does not satisfy the Elastic APM hard constraint | Rejected (constraint) |

## Implementation

### Logging (Fluent Bit → CloudWatch)

Fluent Bit runs as a DaemonSet on every EKS node. It tails container stdout, parses JSON log lines, and forwards to CloudWatch Logs.

Log group naming: `/aerolink/{env}/{service-name}`
Log stream naming: `{pod-name}/{container-name}`

Every log line emitted by a NestJS service is structured JSON:
```json
{
  "timestamp": "2026-05-26T14:23:01.123Z",
  "level": "info",
  "service": "booking-service",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "usr_abc123",
  "message": "Booking saga transitioned to SEAT_LOCKED",
  "bookingId": "bkg_xyz789",
  "durationMs": 42
}
```

`correlationId` is injected by `CorrelationIdMiddleware` from the `x-correlation-id` header and propagated into all Kafka events. This enables cross-service log correlation in CloudWatch Insights.

### Distributed Tracing (AWS X-Ray)

The AWS X-Ray SDK (`aws-xray-sdk-node`) is installed in every NestJS service. A custom `XRayInterceptor` wraps each HTTP handler in a subsegment. Kafka message handlers are manually instrumented with `AWSXRay.captureAsyncFunc`.

The `x-amzn-trace-id` header is propagated:
- HTTP: via API Gateway (automatic)
- Kafka: serialised into the message `headers` field

The X-Ray service map will show the full booking saga path: API Gateway → booking-service → flight-service → payment-service → notification-service.

### APM (Elastic APM)

The Elastic APM Node.js agent is initialised before any `require` in `main.ts`:
```typescript
import 'elastic-apm-node/start'; // reads ELASTIC_APM_* env vars
```

Config injected via AWS Secrets Manager → External Secrets Operator → K8s Secret:
- `ELASTIC_APM_SERVER_URL` — Elastic Cloud APM endpoint
- `ELASTIC_APM_SECRET_TOKEN` — auth token
- `ELASTIC_APM_SERVICE_NAME` — per-service name

Elastic APM provides: transaction traces, span-level DB query timing, error tracking with stack traces, service dependency map.

### Custom CloudWatch Metrics

Published by each service via `@aws-sdk/client-cloudwatch`:

| Metric | Namespace | Dimensions |
|--------|-----------|------------|
| `BookingCreatedCount` | `AeroLink/Booking` | `env`, `status` |
| `BookingSagaDurationMs` | `AeroLink/Booking` | `finalState` |
| `SeatAvailabilityPercent` | `AeroLink/Flight` | `flightId` |
| `PaymentProcessingLatencyMs` | `AeroLink/Payment` | `provider` |
| `BagScanCount` | `AeroLink/Baggage` | `airport`, `status` |
| `KafkaConsumerLag` | `AeroLink/Kafka` | `topic`, `consumerGroup` |

### CloudWatch Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| `BookingSagaFailureRate > 5%` | p99 over 5 min | SNS → PagerDuty (demo: email) |
| `PaymentLatency p99 > 3000ms` | 3 consecutive periods | SNS alert |
| `EKS Node CPU > 80%` | 2 consecutive periods | Triggers Cluster Autoscaler |
| `Aurora FreeLocalStorage < 10 GB` | Immediate | SNS alert |
| `KafkaConsumerLag > 1000` | 5 min | SNS alert + KEDA scales consumers |

## Consequences

- Winston logger configured in every service with `winston-cloudwatch` transport as fallback (Fluent Bit is primary).
- `correlationId` is a first-class field in every log line and Kafka event header.
- X-Ray sampling rule: 100% for booking saga transactions, 5% for read-only flight search.
- Elastic APM trial is sufficient for the 10-day project window; no cost beyond trial.
