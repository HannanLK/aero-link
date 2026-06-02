import { z } from 'zod';
import { BaseEventSchema, MoneySchema } from '../base.event';

export const SeatClassSchema = z.enum(['ECONOMY', 'BUSINESS', 'FIRST']);
export type SeatClass = z.infer<typeof SeatClassSchema>;

// ─── booking.created ──────────────────────────────────────────────────────────

export const BookingCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.booking.created'),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  flightId: z.string().uuid(),
  seatNumber: z.string().min(2).max(4),
  seatClass: SeatClassSchema,
  totalAmount: MoneySchema,
  idempotencyKey: z.string().uuid(),
});
export type BookingCreatedEvent = z.infer<typeof BookingCreatedEventSchema>;

// ─── booking.confirmed ────────────────────────────────────────────────────────

export const BookingConfirmedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.booking.confirmed'),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  flightId: z.string().uuid(),
  flightNumber: z.string(),
  seatNumber: z.string(),
  seatClass: SeatClassSchema,
  departureDatetime: z.string().datetime(),
  arrivalDatetime: z.string().datetime(),
  origin: z.string().length(3),
  destination: z.string().length(3),
  totalAmount: MoneySchema,
  transactionId: z.string().uuid(),
});
export type BookingConfirmedEvent = z.infer<typeof BookingConfirmedEventSchema>;

// ─── booking.cancelled ────────────────────────────────────────────────────────

export const CancellationReasonSchema = z.enum([
  'CUSTOMER_REQUESTED',
  'PAYMENT_FAILED',
  'FLIGHT_CANCELLED',
  'ADMIN_ACTION',
  'SEAT_UNAVAILABLE',
]);

export const BookingCancelledEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.booking.cancelled'),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  flightId: z.string().uuid(),
  seatNumber: z.string(),
  reason: CancellationReasonSchema,
  refundAmount: MoneySchema.optional(),
});
export type BookingCancelledEvent = z.infer<typeof BookingCancelledEventSchema>;

// ─── booking.payment-initiated ────────────────────────────────────────────────

export const BookingPaymentInitiatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.booking.payment-initiated'),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  amount: MoneySchema,
  paymentMethodId: z.string(),
  idempotencyKey: z.string().uuid(),
});
export type BookingPaymentInitiatedEvent = z.infer<typeof BookingPaymentInitiatedEventSchema>;

// ─── booking.seat-released ────────────────────────────────────────────────────

export const BookingSeatReleasedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.booking.seat-released'),
  bookingId: z.string().uuid(),
  flightId: z.string().uuid(),
  seatNumber: z.string(),
});
export type BookingSeatReleasedEvent = z.infer<typeof BookingSeatReleasedEventSchema>;
