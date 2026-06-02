import { z } from 'zod';

export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  version: z.number().int().positive().default(1),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});

export type Money = z.infer<typeof MoneySchema>;
