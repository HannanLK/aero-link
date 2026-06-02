import { z } from 'zod';
import { BaseEventSchema } from '../base.event';

export const FlightStatusSchema = z.enum([
  'SCHEDULED',
  'BOARDING',
  'GATE_CLOSED',
  'DEPARTED',
  'IN_AIR',
  'LANDED',
  'DELAYED',
  'CANCELLED',
]);
export type FlightStatus = z.infer<typeof FlightStatusSchema>;

export const SeatStatusSchema = z.enum(['AVAILABLE', 'LOCKED', 'BOOKED', 'BLOCKED']);
export type SeatStatus = z.infer<typeof SeatStatusSchema>;

// ─── flight.status-changed ────────────────────────────────────────────────────

export const FlightStatusChangedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.flight.status-changed'),
  flightId: z.string().uuid(),
  flightNumber: z.string(),
  previousStatus: FlightStatusSchema,
  newStatus: FlightStatusSchema,
  origin: z.string().length(3),
  destination: z.string().length(3),
  scheduledDeparture: z.string().datetime(),
  estimatedDeparture: z.string().datetime().optional(),
  delayMinutes: z.number().int().nonnegative().optional(),
  gate: z.string().optional(),
  updatedByUserId: z.string().uuid(),
});
export type FlightStatusChangedEvent = z.infer<typeof FlightStatusChangedEventSchema>;

// ─── seat.lock-confirmed ──────────────────────────────────────────────────────

export const SeatLockConfirmedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.seat.lock-confirmed'),
  bookingId: z.string().uuid(),
  flightId: z.string().uuid(),
  seatNumber: z.string(),
  lockExpiresAt: z.string().datetime(),
});
export type SeatLockConfirmedEvent = z.infer<typeof SeatLockConfirmedEventSchema>;

// ─── seat.lock-failed ─────────────────────────────────────────────────────────

export const SeatLockFailedReasonSchema = z.enum([
  'ALREADY_BOOKED',
  'SEAT_NOT_FOUND',
  'FLIGHT_CLOSED',
]);

export const SeatLockFailedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.seat.lock-failed'),
  bookingId: z.string().uuid(),
  flightId: z.string().uuid(),
  seatNumber: z.string(),
  reason: SeatLockFailedReasonSchema,
});
export type SeatLockFailedEvent = z.infer<typeof SeatLockFailedEventSchema>;

// ─── seat.availability-updated ────────────────────────────────────────────────

export const SeatAvailabilityUpdatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.seat.availability-updated'),
  flightId: z.string().uuid(),
  seatNumber: z.string(),
  previousStatus: SeatStatusSchema,
  newStatus: SeatStatusSchema,
});
export type SeatAvailabilityUpdatedEvent = z.infer<typeof SeatAvailabilityUpdatedEventSchema>;
