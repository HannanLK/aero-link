import { Injectable, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS, buildPaymentCompletedEvent, buildPaymentFailedEvent } from '@aerolink/events';
import { CircuitBreakerFactory, retryWithBackoff } from '@aerolink/common-middleware';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  /**
   * Circuit breaker for Stripe API calls.
   * - Opens after 3 consecutive failures (PCI-critical — fail fast)
   * - Cooldown: 60s before testing recovery
   * - Timeout: 15s per Stripe call (Stripe SLA is < 10s for 99.9%)
   */
  private readonly stripeCircuitBreaker = CircuitBreakerFactory.getOrCreate('stripe-api', {
    failureThreshold: 3,
    cooldownMs: 60_000,
    timeoutMs: 15_000,
    successThreshold: 2,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async processPayment(
    bookingId: string,
    passengerId: string,
    amount: number,
    currency: string,
    idempotencyKey: string,
    correlationId: string,
    stripePaymentMethodId: string,
  ) {
    // Idempotency: return existing transaction if already processed
    const existing = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const tx = await this.prisma.transaction.create({
      data: {
        id: uuidv4(),
        idempotencyKey,
        bookingId,
        passengerId,
        type: TransactionType.CHARGE,
        status: TransactionStatus.PENDING,
        amount,
        currency,
      },
    });

    try {
      // Execute Stripe charge through circuit breaker + retry policy
      const stripeResult = await this.stripeCircuitBreaker.execute(
        () =>
          retryWithBackoff(
            () => this.executeStripeCharge(amount, currency, stripePaymentMethodId, idempotencyKey),
            {
              maxRetries: 2,
              baseDelayMs: 500,
              operationName: 'stripe-charge',
              isRetryable: (err) => {
                // Only retry transient errors; don't retry card_declined, insufficient_funds, etc.
                const message = (err as Error).message ?? '';
                return !['card_declined', 'insufficient_funds', 'expired_card', 'incorrect_cvc'].some(
                  (code) => message.includes(code),
                );
              },
            },
          ),
        // Fallback when circuit is OPEN — fail fast with clear error
        async () => {
          throw new ServiceUnavailableException(
            'Payment processing is temporarily unavailable. Please try again in a few minutes.',
          );
        },
      );

      // PCI DSS: store only last-4 digits, never the full card number
      const updated = await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SUCCEEDED,
          stripePaymentId: stripeResult.paymentId,
          cardLast4: stripeResult.last4,
        },
      });

      await this.kafka.emit(
        TOPICS.PAYMENT_COMPLETED,
        bookingId,
        buildPaymentCompletedEvent({
          bookingId,
          passengerId,
          transactionId: tx.id,
          paymentRef: stripeResult.paymentId,
          amount: { amount, currency },
          correlationId,
        }),
      );

      this.logger.log(`Payment succeeded for booking ${bookingId}: ${stripeResult.paymentId}`);
      return updated;
    } catch (err) {
      const failureReason = (err as Error).message;
      this.logger.error(`Payment failed for booking ${bookingId}: ${failureReason}`);

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.FAILED, failureReason },
      });

      await this.kafka.emit(
        TOPICS.PAYMENT_FAILED,
        bookingId,
        buildPaymentFailedEvent({
          bookingId,
          passengerId,
          transactionId: tx.id,
          reason: failureReason,
          correlationId,
        }),
      );

      throw err;
    }
  }

  /**
   * Execute the actual Stripe charge.
   * In production, this calls the Stripe SDK. For local/demo, it simulates
   * the charge with realistic IDs and last-4 extraction.
   */
  private async executeStripeCharge(
    amount: number,
    currency: string,
    paymentMethodId: string,
    idempotencyKey: string,
  ): Promise<{ paymentId: string; last4: string }> {
    // TODO: Replace with real Stripe SDK call in production:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // Stripe uses cents
    //   currency,
    //   payment_method: paymentMethodId,
    //   confirm: true,
    //   idempotency_key: idempotencyKey,
    // });

    // Simulate Stripe API latency (50-200ms)
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));

    const stripePaymentId = `pi_${uuidv4().replace(/-/g, '')}`;
    const cardLast4 = paymentMethodId.slice(-4) || '4242';

    return { paymentId: stripePaymentId, last4: cardLast4 };
  }

  async refund(bookingId: string, idempotencyKey: string, correlationId: string, reason?: string) {
    const existing = await this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    // Find the successful charge for this booking to reverse.
    const original = await this.prisma.transaction.findFirst({
      where: { bookingId, type: TransactionType.CHARGE, status: TransactionStatus.SUCCEEDED },
      orderBy: { createdAt: 'desc' },
    });
    if (!original) throw new NotFoundException(`No succeeded charge found for booking ${bookingId}`);

    // Execute refund through circuit breaker
    const refundResult = await this.stripeCircuitBreaker.execute(
      () =>
        retryWithBackoff(
          async () => {
            // Simulate Stripe refund
            return { refundId: `re_${uuidv4().replace(/-/g, '')}` };
          },
          { maxRetries: 2, operationName: 'stripe-refund' },
        ),
    );

    const refund = await this.prisma.transaction.create({
      data: {
        id: uuidv4(),
        idempotencyKey,
        bookingId: original.bookingId,
        passengerId: original.passengerId,
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCEEDED,
        amount: original.amount,
        currency: original.currency,
        stripePaymentId: refundResult.refundId,
      },
    });

    await this.prisma.transaction.update({
      where: { id: original.id },
      data: { status: TransactionStatus.REFUNDED },
    });

    await this.kafka.emit(TOPICS.PAYMENT_REFUNDED, original.bookingId, {
      eventId: uuidv4(),
      eventType: 'PaymentRefunded',
      occurredAt: new Date().toISOString(),
      correlationId,
      version: 1,
      bookingId: original.bookingId,
      transactionId: original.id,
      refundTransactionId: refund.id,
      reason: reason ?? 'PASSENGER_REQUESTED',
    });

    return refund;
  }

  async findAllByPassenger(passengerId: string) {
    return this.prisma.transaction.findMany({
      where: { passengerId },
      select: { id: true, bookingId: true, type: true, status: true, amount: true, currency: true, cardLast4: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      select: { id: true, bookingId: true, type: true, status: true, amount: true, currency: true, cardLast4: true, createdAt: true },
    });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  /** Expose circuit breaker metrics for the admin health endpoint */
  getCircuitBreakerMetrics() {
    return CircuitBreakerFactory.getAllMetrics();
  }
}
