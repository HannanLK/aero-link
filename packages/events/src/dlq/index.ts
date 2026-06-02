import { z } from 'zod';
import { BaseEventSchema } from '../base.event';

// ─── aerolink.dlq ─────────────────────────────────────────────────────────────

export const DeadLetterEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.dlq'),
  originalTopic: z.string(),
  originalPartition: z.number().int().nonnegative(),
  originalOffset: z.number().int().nonnegative(),
  originalPayload: z.string(),
  failureReason: z.string(),
  failedAt: z.string().datetime(),
  attemptCount: z.number().int().positive(),
  consumerGroup: z.string(),
});
export type DeadLetterEvent = z.infer<typeof DeadLetterEventSchema>;
