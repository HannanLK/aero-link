# AeroLink Kafka Event Catalogue

All events are published to **Amazon MSK** (Kafka 3.6).
Naming convention: `aerolink.<domain>.<verb-past-tense>`
Partition key is always the primary aggregate ID for that domain (ensures ordering within an aggregate).
All events include the standard envelope fields below.

---

## Standard Event Envelope

Every event in the system shares this envelope, enforced by `@aerolink/events`:

```typescript
interface BaseEvent {
  eventId: string;        // UUID v4 — idempotency key for consumers
  eventType: string;      // mirrors topic name, e.g. "aerolink.booking.created"
  occurredAt: string;     // ISO-8601 UTC
  correlationId: string;  // propagated from original HTTP request
  causationId: string;    // eventId of the event that caused this one (empty if first in chain)
  version: number;        // schema version, starts at 1
}
```

---

## Booking Domain

### `aerolink.booking.created`
**Producer:** booking-service | **Consumers:** flight-service
**Partition key:** `flightId`

```typescript
interface BookingCreatedEvent extends BaseEvent {
  bookingId: string;
  passengerId: string;
  flightId: string;
  seatNumber: string;
  seatClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  totalAmount: { amount: number; currency: string };
  idempotencyKey: string;
}
```

### `aerolink.booking.confirmed`
**Producer:** booking-service | **Consumers:** checkin-service, notification-service
**Partition key:** `bookingId`

```typescript
interface BookingConfirmedEvent extends BaseEvent {
  bookingId: string;
  passengerId: string;
  flightId: string;
  flightNumber: string;
  seatNumber: string;
  seatClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  departureDatetime: string;
  arrivalDatetime: string;
  origin: string;      // IATA code
  destination: string; // IATA code
  totalAmount: { amount: number; currency: string };
  transactionId: string;
}
```

### `aerolink.booking.cancelled`
**Producer:** booking-service | **Consumers:** notification-service
**Partition key:** `bookingId`

```typescript
interface BookingCancelledEvent extends BaseEvent {
  bookingId: string;
  passengerId: string;
  flightId: string;
  seatNumber: string;
  reason: 'CUSTOMER_REQUESTED' | 'PAYMENT_FAILED' | 'FLIGHT_CANCELLED' | 'ADMIN_ACTION';
  refundAmount?: { amount: number; currency: string };
}
```

### `aerolink.booking.payment-initiated`
**Producer:** booking-service | **Consumers:** payment-service
**Partition key:** `bookingId`

```typescript
interface BookingPaymentInitiatedEvent extends BaseEvent {
  bookingId: string;
  passengerId: string;
  amount: { amount: number; currency: string };
  paymentMethodId: string; // tokenised payment method reference
  idempotencyKey: string;
}
```

### `aerolink.booking.seat-released`
**Producer:** booking-service | **Consumers:** flight-service
**Partition key:** `flightId`

```typescript
interface BookingSeatReleasedEvent extends BaseEvent {
  bookingId: string;
  flightId: string;
  seatNumber: string;
}
```

---

## Seat Domain (Flight Service)

### `aerolink.seat.lock-confirmed`
**Producer:** flight-service | **Consumers:** booking-service
**Partition key:** `bookingId`

```typescript
interface SeatLockConfirmedEvent extends BaseEvent {
  bookingId: string;
  flightId: string;
  seatNumber: string;
  lockExpiresAt: string; // ISO-8601 — 15 min TTL in Redis
}
```

### `aerolink.seat.lock-failed`
**Producer:** flight-service | **Consumers:** booking-service
**Partition key:** `bookingId`

```typescript
interface SeatLockFailedEvent extends BaseEvent {
  bookingId: string;
  flightId: string;
  seatNumber: string;
  reason: 'ALREADY_BOOKED' | 'SEAT_NOT_FOUND' | 'FLIGHT_CLOSED';
}
```

### `aerolink.seat.availability-updated`
**Producer:** flight-service | **Consumers:** WebSocket gateway (flight-service internal)
**Partition key:** `flightId`

```typescript
interface SeatAvailabilityUpdatedEvent extends BaseEvent {
  flightId: string;
  seatNumber: string;
  previousStatus: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
  newStatus: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
}
```

---

## Payment Domain

### `aerolink.payment.completed`
**Producer:** payment-service | **Consumers:** booking-service
**Partition key:** `bookingId`

```typescript
interface PaymentCompletedEvent extends BaseEvent {
  transactionId: string;
  bookingId: string;
  passengerId: string;
  amount: { amount: number; currency: string };
  paymentProvider: 'STRIPE_STUB';
  processedAt: string;
}
```

### `aerolink.payment.failed`
**Producer:** payment-service | **Consumers:** booking-service
**Partition key:** `bookingId`

```typescript
interface PaymentFailedEvent extends BaseEvent {
  bookingId: string;
  passengerId: string;
  reason: 'INSUFFICIENT_FUNDS' | 'CARD_DECLINED' | 'PROVIDER_ERROR' | 'TIMEOUT';
  retryable: boolean;
}
```

### `aerolink.payment.refunded`
**Producer:** payment-service | **Consumers:** notification-service
**Partition key:** `bookingId`

```typescript
interface PaymentRefundedEvent extends BaseEvent {
  transactionId: string;
  refundId: string;
  bookingId: string;
  passengerId: string;
  amount: { amount: number; currency: string };
  refundedAt: string;
}
```

---

## Flight Domain

### `aerolink.flight.status-changed`
**Producer:** flight-service | **Consumers:** notification-service, WebSocket gateway
**Partition key:** `flightId`

```typescript
type FlightStatus = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'IN_AIR' | 'LANDED' | 'DELAYED' | 'CANCELLED';

interface FlightStatusChangedEvent extends BaseEvent {
  flightId: string;
  flightNumber: string;
  previousStatus: FlightStatus;
  newStatus: FlightStatus;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  estimatedDeparture?: string; // set when DELAYED
  delayMinutes?: number;
  gate?: string;
  updatedByUserId: string;
}
```

---

## Check-in Domain

### `aerolink.checkin.completed`
**Producer:** checkin-service | **Consumers:** baggage-service, notification-service
**Partition key:** `bookingId`

```typescript
interface CheckinCompletedEvent extends BaseEvent {
  checkinId: string;
  bookingId: string;
  passengerId: string;
  flightId: string;
  flightNumber: string;
  seatNumber: string;
  gate: string;
  boardingPassId: string;
  bagCount: number;
  checkedInAt: string;
  checkinMethod: 'WEB' | 'KIOSK' | 'AGENT';
}
```

### `aerolink.baggage.tag-created`
**Producer:** checkin-service | **Consumers:** baggage-service
**Partition key:** `bagId`

```typescript
interface BaggageTagCreatedEvent extends BaseEvent {
  bagId: string;
  barcode: string;   // 10-digit numeric barcode
  qrData: string;    // base64 PNG from Lambda
  bookingId: string;
  passengerId: string;
  flightId: string;
  weight: number;    // kg
  sequence: number;  // bag 1 of N
}
```

---

## Baggage Domain

### `aerolink.baggage.status-updated`
**Producer:** baggage-service | **Consumers:** notification-service
**Partition key:** `bagId`

```typescript
type BaggageStatus = 'TAGGED' | 'CHECKED_IN' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'MISSING';

interface BaggageStatusUpdatedEvent extends BaseEvent {
  bagId: string;
  barcode: string;
  bookingId: string;
  passengerId: string;
  previousStatus: BaggageStatus;
  newStatus: BaggageStatus;
  scannedAt: string;
  location: string;   // airport IATA code or baggage belt identifier
  scannedByUserId: string;
}
```

---

## Identity Domain

### `aerolink.user.registered`
**Producer:** identity-service | **Consumers:** notification-service
**Partition key:** `userId`

```typescript
interface UserRegisteredEvent extends BaseEvent {
  userId: string;
  email: string;   // GDPR: only used for welcome email, not stored in notification log
  roles: string[];
  registeredAt: string;
}
```

---

## Dead Letter Topic

### `aerolink.dlq`
All messages that fail processing after 3 retries are routed here.

```typescript
interface DeadLetterEvent extends BaseEvent {
  originalTopic: string;
  originalPartition: number;
  originalOffset: number;
  originalPayload: string; // JSON-stringified original event
  failureReason: string;
  failedAt: string;
  attemptCount: number;
  consumerGroup: string;
}
```

---

## Topic Configuration Summary

| Topic | Partitions | Replication Factor | Retention | Partition Key |
|-------|:---:|:---:|---|---|
| `aerolink.booking.created` | 6 | 3 | 7 days | `flightId` |
| `aerolink.booking.confirmed` | 6 | 3 | 30 days | `bookingId` |
| `aerolink.booking.cancelled` | 3 | 3 | 30 days | `bookingId` |
| `aerolink.booking.payment-initiated` | 6 | 3 | 1 day | `bookingId` |
| `aerolink.booking.seat-released` | 6 | 3 | 1 day | `flightId` |
| `aerolink.seat.lock-confirmed` | 6 | 3 | 1 day | `bookingId` |
| `aerolink.seat.lock-failed` | 3 | 3 | 1 day | `bookingId` |
| `aerolink.seat.availability-updated` | 6 | 3 | 1 hour | `flightId` |
| `aerolink.payment.completed` | 3 | 3 | 30 days | `bookingId` |
| `aerolink.payment.failed` | 3 | 3 | 7 days | `bookingId` |
| `aerolink.payment.refunded` | 3 | 3 | 30 days | `bookingId` |
| `aerolink.flight.status-changed` | 6 | 3 | 7 days | `flightId` |
| `aerolink.checkin.completed` | 6 | 3 | 7 days | `bookingId` |
| `aerolink.baggage.tag-created` | 6 | 3 | 7 days | `bagId` |
| `aerolink.baggage.status-updated` | 12 | 3 | 7 days | `bagId` |
| `aerolink.user.registered` | 3 | 3 | 7 days | `userId` |
| `aerolink.dlq` | 3 | 3 | 14 days | `consumerGroup` |
