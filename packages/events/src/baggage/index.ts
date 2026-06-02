import { z } from 'zod';
import { BaseEventSchema } from '../base.event';

export const BaggageStatusSchema = z.enum([
  'TAGGED',
  'CHECKED_IN',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'MISSING',
]);
export type BaggageStatus = z.infer<typeof BaggageStatusSchema>;

// ─── baggage.status-updated ───────────────────────────────────────────────────

export const BaggageStatusUpdatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.baggage.status-updated'),
  bagId: z.string().uuid(),
  barcode: z.string().length(10),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  previousStatus: BaggageStatusSchema,
  newStatus: BaggageStatusSchema,
  scannedAt: z.string().datetime(),
  location: z.string(),
  scannedByUserId: z.string().uuid(),
});
export type BaggageStatusUpdatedEvent = z.infer<typeof BaggageStatusUpdatedEventSchema>;
