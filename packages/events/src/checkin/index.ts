import { z } from 'zod';
import { BaseEventSchema } from '../base.event';

export const CheckinMethodSchema = z.enum(['WEB', 'KIOSK', 'AGENT']);

// ─── checkin.completed ────────────────────────────────────────────────────────

export const CheckinCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.checkin.completed'),
  checkinId: z.string().uuid(),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  flightId: z.string().uuid(),
  flightNumber: z.string(),
  seatNumber: z.string(),
  gate: z.string(),
  boardingPassId: z.string().uuid(),
  bagCount: z.number().int().min(0).max(9),
  checkedInAt: z.string().datetime(),
  checkinMethod: CheckinMethodSchema,
});
export type CheckinCompletedEvent = z.infer<typeof CheckinCompletedEventSchema>;

// ─── baggage.tag-created ──────────────────────────────────────────────────────

export const BaggageTagCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.baggage.tag-created'),
  bagId: z.string().uuid(),
  barcode: z.string().length(10),
  qrData: z.string(),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  flightId: z.string().uuid(),
  weight: z.number().nonnegative().max(50),
  sequence: z.number().int().positive(),
});
export type BaggageTagCreatedEvent = z.infer<typeof BaggageTagCreatedEventSchema>;
