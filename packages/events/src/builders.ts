// Event builder helpers. Each takes the fields a service actually has and fills
// in the BaseEvent envelope (eventId/occurredAt/version) plus any schema-required
// fields with sensible defaults, so the produced event validates against its Zod
// schema at runtime.
import { randomUUID } from 'crypto';
import { Money } from './base.event';

const now = () => new Date().toISOString();
function envelope(eventType: string, correlationId: string, eventId?: string) {
  return {
    eventId: eventId ?? randomUUID(),
    eventType,
    occurredAt: now(),
    correlationId,
    version: 1,
  };
}

// ─── identity ────────────────────────────────────────────────────────────────
export function buildUserRegisteredEvent(i: {
  userId: string; email: string; firstName?: string; lastName?: string;
  roles?: string[]; correlationId: string;
}) {
  return {
    ...envelope('aerolink.user.registered', i.correlationId),
    userId: i.userId,
    email: i.email,
    roles: i.roles ?? ['CUSTOMER'],
    registeredAt: now(),
  };
}

// ─── booking ─────────────────────────────────────────────────────────────────
export function buildBookingCreatedEvent(i: {
  bookingId: string; passengerId: string; flightId: string; seatNumber: string;
  totalAmount: Money; seatClass?: string; idempotencyKey?: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.booking.created', i.correlationId),
    bookingId: i.bookingId,
    passengerId: i.passengerId,
    flightId: i.flightId,
    seatNumber: i.seatNumber,
    seatClass: i.seatClass ?? 'ECONOMY',
    totalAmount: i.totalAmount,
    idempotencyKey: i.idempotencyKey ?? randomUUID(),
  };
}

// ─── flight ──────────────────────────────────────────────────────────────────
export function buildFlightStatusChangedEvent(i: {
  flightId: string; flightNumber: string; previousStatus: string; newStatus: string;
  origin?: string; destination?: string; scheduledDeparture?: string;
  updatedByUserId?: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.flight.status-changed', i.correlationId),
    flightId: i.flightId,
    flightNumber: i.flightNumber,
    previousStatus: i.previousStatus,
    newStatus: i.newStatus,
    origin: i.origin ?? 'N/A',
    destination: i.destination ?? 'N/A',
    scheduledDeparture: i.scheduledDeparture ?? now(),
    updatedByUserId: i.updatedByUserId ?? randomUUID(),
  };
}

// ─── seat ────────────────────────────────────────────────────────────────────
export function buildSeatLockConfirmedEvent(i: {
  bookingId: string; flightId: string; seatNumber: string;
  lockExpiresAt?: string; eventId?: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.seat.lock-confirmed', i.correlationId, i.eventId),
    bookingId: i.bookingId,
    flightId: i.flightId,
    seatNumber: i.seatNumber,
    lockExpiresAt: i.lockExpiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

const SEAT_FAIL_REASONS = new Set(['ALREADY_BOOKED', 'SEAT_NOT_FOUND', 'FLIGHT_CLOSED']);
export function buildSeatLockFailedEvent(i: {
  bookingId: string; flightId: string; seatNumber: string; reason: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.seat.lock-failed', i.correlationId),
    bookingId: i.bookingId,
    flightId: i.flightId,
    seatNumber: i.seatNumber,
    reason: SEAT_FAIL_REASONS.has(i.reason) ? i.reason : 'ALREADY_BOOKED',
  };
}

// ─── payment ─────────────────────────────────────────────────────────────────
export function buildPaymentCompletedEvent(i: {
  bookingId: string; passengerId: string; transactionId: string;
  amount: Money; paymentRef?: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.payment.completed', i.correlationId),
    transactionId: i.transactionId,
    bookingId: i.bookingId,
    passengerId: i.passengerId,
    amount: i.amount,
    paymentProvider: 'STRIPE_STUB',
    processedAt: now(),
    paymentRef: i.paymentRef,
  };
}

const PAY_FAIL_REASONS = new Set(['INSUFFICIENT_FUNDS', 'CARD_DECLINED', 'PROVIDER_ERROR', 'TIMEOUT']);
export function buildPaymentFailedEvent(i: {
  bookingId: string; passengerId: string; transactionId?: string;
  reason: string; retryable?: boolean; correlationId: string;
}) {
  return {
    ...envelope('aerolink.payment.failed', i.correlationId),
    bookingId: i.bookingId,
    passengerId: i.passengerId,
    reason: PAY_FAIL_REASONS.has(i.reason) ? i.reason : 'PROVIDER_ERROR',
    retryable: i.retryable ?? false,
    transactionId: i.transactionId,
    failureReason: i.reason,
  };
}

// ─── checkin ─────────────────────────────────────────────────────────────────
export function buildCheckinCompletedEvent(i: {
  bookingId: string; passengerId: string; flightId: string; seatNumber: string;
  flightNumber?: string; gate?: string; bagCount?: number; correlationId: string;
}) {
  return {
    ...envelope('aerolink.checkin.completed', i.correlationId),
    checkinId: randomUUID(),
    bookingId: i.bookingId,
    passengerId: i.passengerId,
    flightId: i.flightId,
    flightNumber: i.flightNumber ?? 'N/A',
    seatNumber: i.seatNumber,
    gate: i.gate ?? 'TBD',
    boardingPassId: randomUUID(),
    bagCount: i.bagCount ?? 0,
    checkedInAt: now(),
    checkinMethod: 'WEB',
  };
}

// ─── baggage ─────────────────────────────────────────────────────────────────
export function buildBaggageTagCreatedEvent(i: {
  bookingId: string; passengerId: string; flightId: string; barcode: string;
  bagId?: string; weight?: number; sequence?: number; correlationId: string;
}) {
  return {
    ...envelope('aerolink.baggage.tag-created', i.correlationId),
    bagId: i.bagId ?? randomUUID(),
    barcode: i.barcode,
    qrData: i.barcode,
    bookingId: i.bookingId,
    passengerId: i.passengerId,
    flightId: i.flightId,
    weight: i.weight ?? 0,
    sequence: i.sequence ?? 1,
  };
}

export function buildBaggageStatusUpdatedEvent(i: {
  bagId: string; barcode: string; bookingId: string; flightId: string;
  previousStatus: string; newStatus: string; scannedBy: string;
  passengerId?: string; location?: string; correlationId: string;
}) {
  return {
    ...envelope('aerolink.baggage.status-updated', i.correlationId),
    bagId: i.bagId,
    barcode: i.barcode,
    bookingId: i.bookingId,
    passengerId: i.passengerId ?? randomUUID(),
    previousStatus: i.previousStatus,
    newStatus: i.newStatus,
    scannedAt: now(),
    location: i.location ?? 'N/A',
    scannedByUserId: i.scannedBy,
  };
}
