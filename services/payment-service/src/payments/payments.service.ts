import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS, buildPaymentCompletedEvent, buildPaymentFailedEvent } from '@aerolink/events';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

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
      // Stripe integration: in production, call Stripe API here.
      // We record last-4 only (PCI DSS compliance — never store full card number).
      const stripePaymentId = `pi_${uuidv4().replace(/-/g, '')}`;
      const cardLast4 = stripePaymentMethodId.slice(-4);

      const updated = await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.SUCCEEDED, stripePaymentId, cardLast4 },
      });

      await this.kafka.emit(TOPICS.PAYMENT_COMPLETED, bookingId, buildPaymentCompletedEvent({
        bookingId,
        passengerId,
        transactionId: tx.id,
        paymentRef: stripePaymentId,
        amount: { amount, currency },
        correlationId,
      }));

      return updated;
    } catch (err) {
      const failureReason = (err as Error).message;
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: TransactionStatus.FAILED, failureReason },
      });

      await this.kafka.emit(TOPICS.PAYMENT_FAILED, bookingId, buildPaymentFailedEvent({
        bookingId,
        passengerId,
        transactionId: tx.id,
        reason: failureReason,
        correlationId,
      }));

      throw err;
    }
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
        stripePaymentId: `re_${uuidv4().replace(/-/g, '')}`,
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
}
