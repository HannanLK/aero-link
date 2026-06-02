# ADR-003 — Event-Driven Architecture: Kafka Choreography Saga + CQRS

| Field      | Value |
|------------|-------|
| Status     | Accepted |
| Date       | 2026-05-26 |
| Deciders   | Architecture Team |
| Rubric     | Task 2 (Distributed APIs + event-driven), Task 3 (data consistency), Task 4 (real-time sync) |

## Context

The booking flow spans three services (flight, booking, payment) and must guarantee that:
- A seat is never double-booked (concurrency-safe)
- Payment failure releases the seat lock (compensation)
- Ticket issuance is only triggered after confirmed payment
- All state transitions are auditable

Additionally, flight status changes (delayed, cancelled) and baggage scan events must propagate to all interested services and the frontend in near-real-time.

## Decision

**Kafka Choreography Saga** for the booking distributed transaction.
**CQRS** on flight-service for seat availability reads.
**Amazon MSK** (managed Kafka 3.6) as the event bus.

## Saga Pattern: Choreography vs. Orchestration

| Pattern | Pros | Cons |
|---------|------|------|
| **Choreography (chosen)** | No single point of failure, services are autonomous, natural audit trail via Kafka offsets | Harder to visualise flow (mitigated by event catalogue + sequence diagram) |
| Orchestration (Saga Orchestrator) | Centralised flow visibility | Extra service to deploy and maintain; single point of failure |

With only four participants in the booking saga (client → booking → flight → payment), choreography is the simpler and more resilient choice. Each participant reacts to domain events and emits its own events.

## Booking Saga State Machine

```
                    booking-service SAGA STATES
                    ───────────────────────────
  [PENDING] ──(booking.created)──► [AWAITING_SEAT_LOCK]
      │
      ├──(seat.lock-confirmed)──► [SEAT_LOCKED]
      │                                │
      │                         (booking.payment-initiated)
      │                                │
      │                          [AWAITING_PAYMENT]
      │                                │
      │           ┌────────────────────┤
      │           │                    │
      │    (payment.failed)    (payment.completed)
      │           │                    │
      │     [COMPENSATING]         [CONFIRMED]
      │           │
      │    (booking.seat-released)
      │           │
      └──(seat.lock-failed)──► [CANCELLED]
```

## Kafka Topics

All topics use the naming convention `aerolink.<domain>.<event>` with 3 partitions and replication factor 3.

| Topic | Producer | Consumers | Partition Key |
|-------|----------|-----------|---------------|
| `aerolink.booking.created` | booking-service | flight-service | `flightId` |
| `aerolink.booking.confirmed` | booking-service | checkin-service, notification-service | `bookingId` |
| `aerolink.booking.cancelled` | booking-service | notification-service | `bookingId` |
| `aerolink.booking.payment-initiated` | booking-service | payment-service | `bookingId` |
| `aerolink.booking.seat-released` | booking-service | flight-service | `flightId` |
| `aerolink.seat.lock-confirmed` | flight-service | booking-service | `bookingId` |
| `aerolink.seat.lock-failed` | flight-service | booking-service | `bookingId` |
| `aerolink.seat.availability-updated` | flight-service | (WebSocket gateway) | `flightId` |
| `aerolink.payment.completed` | payment-service | booking-service | `bookingId` |
| `aerolink.payment.failed` | payment-service | booking-service | `bookingId` |
| `aerolink.payment.refunded` | payment-service | notification-service | `bookingId` |
| `aerolink.flight.status-changed` | flight-service | notification-service, (WebSocket) | `flightId` |
| `aerolink.checkin.completed` | checkin-service | baggage-service, notification-service | `bookingId` |
| `aerolink.baggage.tag-created` | checkin-service | baggage-service | `bagId` |
| `aerolink.baggage.status-updated` | baggage-service | notification-service | `bagId` |
| `aerolink.user.registered` | identity-service | notification-service | `userId` |

## CQRS on flight-service

Seat availability is queried far more than it is written. A full PostgreSQL scan on every seat-map request would not scale.

- **Write side:** Aurora PostgreSQL `seats` table. Updates on booking/release.
- **Read side:** Redis Hash `seat:map:{flightId}` — a denormalised in-memory projection of seat states. Updated by flight-service consuming `aerolink.seat.lock-confirmed` and `aerolink.booking.seat-released`.
- **Projection TTL:** 5 minutes; rebuilt from Aurora on cache miss.
- **WebSocket push:** When the Redis projection is updated, a Kafka `aerolink.seat.availability-updated` event triggers the flight-service WebSocket gateway to push the delta to subscribed browser clients.

This satisfies rubric task 4 (real-time data synchronisation) and task 3 (CQRS justification).

## Idempotency

Every Kafka consumer uses the `bookingId` or `bagId` as an idempotency key stored in Redis with a 24-hour TTL. Duplicate messages (Kafka at-least-once delivery) are silently discarded.

## Consequences

- booking-service stores saga state (`BookingSagaState` table) — each state transition is persisted before publishing the next event.
- Compensating transactions are explicit domain events, not hidden retries.
- Kafka consumer group IDs follow `aerolink-{service}-group` naming to allow independent offset management.
- Dead-letter topic: `aerolink.dlq` receives any message that fails processing after 3 retries.
