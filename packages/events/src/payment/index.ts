import { z } from 'zod';
import { BaseEventSchema, MoneySchema } from '../base.event';

// ─── payment.completed ────────────────────────────────────────────────────────

export const PaymentCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.payment.completed'),
  transactionId: z.string().uuid(),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  amount: MoneySchema,
  paymentProvider: z.literal('STRIPE_STUB'),
  processedAt: z.string().datetime(),
  paymentRef: z.string().optional(),
});
export type PaymentCompletedEvent = z.infer<typeof PaymentCompletedEventSchema>;

// ─── payment.failed ───────────────────────────────────────────────────────────

export const PaymentFailedReasonSchema = z.enum([
  'INSUFFICIENT_FUNDS',
  'CARD_DECLINED',
  'PROVIDER_ERROR',
  'TIMEOUT',
]);

export const PaymentFailedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.payment.failed'),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  reason: PaymentFailedReasonSchema,
  retryable: z.boolean(),
});
export type PaymentFailedEvent = z.infer<typeof PaymentFailedEventSchema>;

// ─── payment.refunded ─────────────────────────────────────────────────────────

export const PaymentRefundedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.payment.refunded'),
  transactionId: z.string().uuid(),
  refundId: z.string().uuid(),
  bookingId: z.string().uuid(),
  passengerId: z.string().uuid(),
  amount: MoneySchema,
  refundedAt: z.string().datetime(),
});
export type PaymentRefundedEvent = z.infer<typeof PaymentRefundedEventSchema>;
