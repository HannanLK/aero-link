export * from './base.event';
export * from './booking';
export * from './flight';
export * from './payment';
export * from './checkin';
export * from './baggage';
export * from './identity';
export * from './dlq';

export const TOPICS = {
  BOOKING_CREATED: 'aerolink.booking.created',
  BOOKING_CONFIRMED: 'aerolink.booking.confirmed',
  BOOKING_CANCELLED: 'aerolink.booking.cancelled',
  BOOKING_PAYMENT_INITIATED: 'aerolink.booking.payment-initiated',
  BOOKING_SEAT_RELEASED: 'aerolink.booking.seat-released',
  SEAT_LOCK_CONFIRMED: 'aerolink.seat.lock-confirmed',
  SEAT_LOCK_FAILED: 'aerolink.seat.lock-failed',
  SEAT_AVAILABILITY_UPDATED: 'aerolink.seat.availability-updated',
  PAYMENT_COMPLETED: 'aerolink.payment.completed',
  PAYMENT_FAILED: 'aerolink.payment.failed',
  PAYMENT_REFUNDED: 'aerolink.payment.refunded',
  FLIGHT_STATUS_CHANGED: 'aerolink.flight.status-changed',
  CHECKIN_COMPLETED: 'aerolink.checkin.completed',
  BAGGAGE_TAG_CREATED: 'aerolink.baggage.tag-created',
  BAGGAGE_STATUS_UPDATED: 'aerolink.baggage.status-updated',
  USER_REGISTERED: 'aerolink.user.registered',
  DLQ: 'aerolink.dlq',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
