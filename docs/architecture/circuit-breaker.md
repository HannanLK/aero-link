# AeroLink — Circuit Breaker Architecture

## Overview

AeroLink implements the **Circuit Breaker pattern** to prevent cascading failures across microservices. When a downstream dependency (e.g., Stripe API, AWS SES, flight-service) becomes unresponsive, the circuit breaker "trips" and immediately fails requests without attempting the call, allowing the failing service time to recover.

## Circuit Breaker State Machine

```mermaid
stateDiagram-v2
    direction LR
    [*] --> CLOSED

    CLOSED --> OPEN: Failure count ≥ threshold (5)
    OPEN --> HALF_OPEN: Cooldown elapsed (30s)
    HALF_OPEN --> CLOSED: Test requests succeed (2)
    HALF_OPEN --> OPEN: Test request fails

    state CLOSED {
        [*] --> Normal
        Normal: Requests pass through
        Normal: Failures counted
        Normal: Success resets counter
    }

    state OPEN {
        [*] --> FailFast
        FailFast: Requests fail immediately
        FailFast: No downstream calls made
        FailFast: Cooldown timer running
    }

    state HALF_OPEN {
        [*] --> Testing
        Testing: Allow limited test requests
        Testing: Monitor success/failure
        Testing: Decide CLOSED or OPEN
    }
```

## Implementation

The circuit breaker is implemented as a shared utility in `@aerolink/common-middleware` (`packages/common-middleware/src/circuit-breaker.ts`) and can be reused across all services.

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `failureThreshold` | 5 | Consecutive failures before CLOSED → OPEN |
| `cooldownMs` | 30,000ms | Time in OPEN before testing (→ HALF_OPEN) |
| `timeoutMs` | 10,000ms | Request timeout (counts as failure) |
| `successThreshold` | 2 | Successful tests before HALF_OPEN → CLOSED |

### Usage Example

```typescript
import { CircuitBreakerFactory } from '@aerolink/common-middleware';

@Injectable()
export class PaymentsService {
  private readonly stripeCircuitBreaker = CircuitBreakerFactory.getOrCreate('stripe-api', {
    failureThreshold: 3,
    cooldownMs: 60_000,  // 1 minute cooldown for payment provider
    timeoutMs: 15_000,   // 15s timeout for Stripe calls
  });

  async chargeCard(amount: number, currency: string, token: string) {
    return this.stripeCircuitBreaker.execute(
      // Primary function
      () => this.stripe.charges.create({ amount, currency, source: token }),
      // Fallback when circuit is OPEN
      () => { throw new ServiceUnavailableException('Payment service temporarily unavailable'); },
    );
  }
}
```

## Per-Service Circuit Breaker Configuration

### booking-service

```mermaid
graph LR
    BS["booking-service"] -->|"Circuit Breaker"| FS["flight-service<br/>(seat lock)"]
    
    subgraph "CB: flight-seat-lock"
        T1["Threshold: 5 failures"]
        T2["Cooldown: 30s"]
        T3["Timeout: 10s"]
    end
```

| Downstream | Circuit Name | Threshold | Cooldown | Timeout | Fallback |
|-----------|-------------|-----------|----------|---------|----------|
| flight-service (via Kafka) | `flight-seat-lock` | 5 | 30s | 10s | Cancel booking with reason |

### payment-service

```mermaid
graph LR
    PS["payment-service"] -->|"Circuit Breaker"| Stripe["Stripe API"]
    
    subgraph "CB: stripe-api"
        T4["Threshold: 3 failures"]
        T5["Cooldown: 60s"]
        T6["Timeout: 15s"]
    end
```

| Downstream | Circuit Name | Threshold | Cooldown | Timeout | Fallback |
|-----------|-------------|-----------|----------|---------|----------|
| Stripe API | `stripe-api` | 3 | 60s | 15s | Queue for retry, return 503 |

### checkin-service

```mermaid
graph LR
    CS["checkin-service"] -->|"Circuit Breaker"| LQ["Lambda QR Generator"]
    
    subgraph "CB: lambda-qr"
        T7["Threshold: 5 failures"]
        T8["Cooldown: 30s"]
        T9["Timeout: 10s"]
    end
```

| Downstream | Circuit Name | Threshold | Cooldown | Timeout | Fallback |
|-----------|-------------|-----------|----------|---------|----------|
| Lambda QR | `lambda-qr` | 5 | 30s | 10s | Return text-only boarding pass |

### notification-service

```mermaid
graph LR
    NS["notification-service"] -->|"Circuit Breaker"| SES["AWS SES"]
    NS -->|"Circuit Breaker"| SNS["AWS SNS"]
    
    subgraph "CB: ses-email"
        T10["Threshold: 5 failures"]
        T11["Cooldown: 120s"]
        T12["Timeout: 10s"]
    end
```

| Downstream | Circuit Name | Threshold | Cooldown | Timeout | Fallback |
|-----------|-------------|-----------|----------|---------|----------|
| AWS SES | `ses-email` | 5 | 120s | 10s | Log notification, retry later |
| AWS SNS | `sns-sms` | 5 | 120s | 10s | Log notification, retry later |

## Retry Policy Integration

Circuit breakers work alongside **exponential backoff retry**:

```mermaid
graph TD
    Request["Incoming Request"] --> CB{"Circuit<br/>Breaker<br/>State?"}
    CB -->|"OPEN"| Fail["Fail Fast<br/>(no retry)"]
    CB -->|"CLOSED/HALF_OPEN"| Retry{"Retry<br/>Policy"}
    Retry -->|"Attempt 1"| Call["Call Downstream"]
    Call -->|"Success"| Success["Return Result"]
    Call -->|"Failure"| Wait["Wait: 1s × 2^attempt"]
    Wait --> Retry
    Retry -->|"Max retries (3)"| CBUpdate["Update Circuit Breaker<br/>Failure Count"]
    CBUpdate --> Fail2["Throw Error"]
```

### Retry Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Max retries | 3 | Enough for transient network issues |
| Base delay | 1,000ms | Start with 1 second |
| Max delay | 30,000ms | Cap at 30 seconds |
| Jitter | 20% | Prevent thundering herd |
| Backoff formula | `min(1000 × 2^attempt + jitter, 30000)` | Exponential with cap |

## Monitoring & Metrics

Circuit breaker metrics are exposed via the **Admin Dashboard** health endpoint:

```json
{
  "circuitBreakers": {
    "stripe-api": {
      "state": "CLOSED",
      "failureCount": 0,
      "totalRequests": 1523,
      "totalFailures": 12,
      "totalShortCircuits": 3,
      "lastFailureTime": "2026-06-04T10:23:45Z"
    },
    "ses-email": {
      "state": "HALF_OPEN",
      "failureCount": 5,
      "totalRequests": 892,
      "totalFailures": 47,
      "totalShortCircuits": 15,
      "lastFailureTime": "2026-06-04T10:30:12Z"
    }
  }
}
```

## Cascading Failure Prevention

Without circuit breakers, a failure in one service can cascade:

```mermaid
graph TD
    subgraph "Without Circuit Breaker"
        A1["Stripe Down"] --> B1["payment-service<br/>Timeout (30s)"]
        B1 --> C1["booking-service<br/>Waiting (30s)"]
        C1 --> D1["API Gateway<br/>Timeout (30s)"]
        D1 --> E1["User sees error<br/>after 90s"]
    end
```

```mermaid
graph TD
    subgraph "With Circuit Breaker"
        A2["Stripe Down"] --> B2["Circuit OPEN<br/>Fail fast (1ms)"]
        B2 --> C2["booking-service<br/>Immediate 503"]
        C2 --> D2["User sees<br/>'Try again later'<br/>< 100ms"]
    end
```
