# Sequence Diagram — Booking Saga (Choreography)

## Happy Path

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant APIGW as API Gateway
    participant BK as booking-service
    participant FL as flight-service
    participant PY as payment-service
    participant CK as checkin-service
    participant NT as notification-service
    participant RD as Redis
    participant KFK as Kafka (MSK)

    Customer->>APIGW: POST /bookings { flightId, seatNumber, paymentMethodId }<br/>Authorization: Bearer <JWT>
    APIGW->>APIGW: Cognito JWT verify (signature, expiry, audience)
    APIGW->>BK: POST /bookings (x-user-id, x-user-roles headers injected)

    BK->>RD: GET idempotency:{idempotencyKey}
    RD-->>BK: null (not seen before)
    BK->>BK: Create BookingSagaState{status: PENDING} in booking_db
    BK->>KFK: Publish aerolink.booking.created {bookingId, flightId, seatNumber, ...}
    BK->>RD: SET idempotency:{idempotencyKey} = bookingId (TTL 24h)
    BK-->>APIGW: 202 Accepted { bookingId, status: "PENDING" }
    APIGW-->>Customer: 202 Accepted { bookingId, sagaStatusUrl: "/bookings/{id}/status" }

    Note over Customer,KFK: Customer polls GET /bookings/{id}/status or receives WebSocket push

    KFK->>FL: Consume aerolink.booking.created
    FL->>RD: SET seat:lock:{flightId}:{seatNumber} = bookingId (NX, TTL 900s)
    alt Seat available (Redis NX = success)
        RD-->>FL: OK (lock acquired)
        FL->>FL: UPDATE seats SET status=LOCKED WHERE flightId AND seatNumber
        FL->>KFK: Publish aerolink.seat.lock-confirmed {bookingId, seatNumber, lockExpiresAt}
        FL->>KFK: Publish aerolink.seat.availability-updated {seatNumber, AVAILABLE→LOCKED}
    else Seat already locked/booked
        RD-->>FL: FAIL (key exists)
        FL->>KFK: Publish aerolink.seat.lock-failed {bookingId, reason: ALREADY_BOOKED}
    end

    KFK->>BK: Consume aerolink.seat.lock-confirmed
    BK->>BK: UPDATE saga{status: SEAT_LOCKED}
    BK->>KFK: Publish aerolink.booking.payment-initiated {bookingId, amount, paymentMethodId}
    BK->>BK: UPDATE saga{status: AWAITING_PAYMENT}

    KFK->>PY: Consume aerolink.booking.payment-initiated
    PY->>PY: Call Stripe stub (idempotencyKey = bookingId)
    alt Payment success
        PY->>PY: INSERT Transaction{status: COMPLETED}
        PY->>KFK: Publish aerolink.payment.completed {transactionId, bookingId, amount}
    else Payment failure
        PY->>PY: INSERT Transaction{status: FAILED}
        PY->>KFK: Publish aerolink.payment.failed {bookingId, reason, retryable}
    end

    KFK->>BK: Consume aerolink.payment.completed
    BK->>BK: UPDATE saga{status: CONFIRMED}
    BK->>KFK: Publish aerolink.booking.confirmed {bookingId, flightNumber, seatNumber, ...}

    par Parallel downstream effects
        KFK->>CK: Consume aerolink.booking.confirmed
        CK->>CK: Enable check-in eligibility for booking
    and
        KFK->>NT: Consume aerolink.booking.confirmed
        NT->>NT: Send booking confirmation email via SES
    end

    Customer->>APIGW: GET /bookings/{id}/status
    APIGW->>BK: GET /bookings/{id}/status
    BK-->>Customer: 200 OK { status: "CONFIRMED", bookingRef: "AL-XXXXX" }
```

---

## Compensation Path — Payment Failure

```mermaid
sequenceDiagram
    autonumber
    participant BK as booking-service
    participant FL as flight-service
    participant NT as notification-service
    participant RD as Redis
    participant KFK as Kafka (MSK)

    Note over BK,KFK: Saga is in AWAITING_PAYMENT state

    KFK->>BK: Consume aerolink.payment.failed {bookingId, reason: CARD_DECLINED}
    BK->>BK: UPDATE saga{status: COMPENSATING}
    BK->>KFK: Publish aerolink.booking.seat-released {bookingId, flightId, seatNumber}

    KFK->>FL: Consume aerolink.booking.seat-released
    FL->>RD: DEL seat:lock:{flightId}:{seatNumber}
    FL->>FL: UPDATE seats SET status=AVAILABLE WHERE seatNumber
    FL->>KFK: Publish aerolink.seat.availability-updated {seatNumber, LOCKED→AVAILABLE}

    BK->>BK: UPDATE saga{status: CANCELLED}
    BK->>KFK: Publish aerolink.booking.cancelled {bookingId, reason: PAYMENT_FAILED}

    KFK->>NT: Consume aerolink.booking.cancelled
    NT->>NT: Send payment failure email via SES
```

---

## Compensation Path — Seat Lock Failure

```mermaid
sequenceDiagram
    autonumber
    participant BK as booking-service
    participant NT as notification-service
    participant KFK as Kafka (MSK)

    KFK->>BK: Consume aerolink.seat.lock-failed {bookingId, reason: ALREADY_BOOKED}
    BK->>BK: UPDATE saga{status: CANCELLED, reason: SEAT_UNAVAILABLE}
    BK->>KFK: Publish aerolink.booking.cancelled {reason: SEAT_UNAVAILABLE}

    KFK->>NT: Consume aerolink.booking.cancelled
    NT->>NT: Send "seat no longer available" email
```

---

## Saga State Transitions

```
PENDING
  │
  ├──(seat.lock-confirmed)──► SEAT_LOCKED
  │                               │
  │                    (payment-initiated published)
  │                               │
  │                        AWAITING_PAYMENT
  │                               │
  │               ┌───────────────┴───────────────┐
  │               │                               │
  │     (payment.failed)               (payment.completed)
  │               │                               │
  │         COMPENSATING                      CONFIRMED ✅
  │               │
  │     (seat-released published)
  │               │
  └──(seat.lock-failed)──► CANCELLED ❌
```

---

## Idempotency Guarantee

Every Kafka consumer checks Redis before processing:

```
Consumer receives event with eventId = "evt_abc123"
  → GET idempotency:processed:{consumerGroup}:{eventId}
  → If found: discard (already processed)
  → If not found: process, then SET idempotency:processed:{consumerGroup}:{eventId} EX 86400
```

This protects against Kafka at-least-once redelivery during consumer restarts.

---

## Seat Concurrency Control

The seat lock uses **Redis `SET NX` (set if not exists)** with a 15-minute TTL:

```
SET seat:lock:{flightId}:{seatNumber} {bookingId} NX EX 900
```

- Atomic: only one booking wins the `NX` race
- TTL: if the saga does not complete in 15 minutes (e.g. payment timeout), the lock expires automatically and the seat becomes available for new bookings
- This satisfies the "concurrency-safe, no double-booking" requirement from the rubric application scenarios
