import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { BookingStatus } from '@prisma/client';
import {
  TOPICS,
  SeatLockConfirmedEventSchema,
  SeatLockFailedEventSchema,
  PaymentCompletedEventSchema,
  PaymentFailedEventSchema,
} from '@aerolink/events';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class SagaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaConsumer.name);
  private consumer: Consumer;

  constructor(
    @Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string; groupId: string },
    private readonly bookingsService: BookingsService,
  ) {
    const kafka = new Kafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.consumer = kafka.consumer({ groupId: this.config.groupId });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        TOPICS.SEAT_LOCK_CONFIRMED,
        TOPICS.SEAT_LOCK_FAILED,
        TOPICS.PAYMENT_COMPLETED,
        TOPICS.PAYMENT_FAILED,
      ],
      fromBeginning: false,
    });

    await this.consumer.run({ eachMessage: async ({ topic, message }) => {
      const raw = JSON.parse(message.value?.toString() ?? '{}');
      switch (topic) {
        case TOPICS.SEAT_LOCK_CONFIRMED: {
          const e = SeatLockConfirmedEventSchema.safeParse(raw);
          if (!e.success) return;
          await this.bookingsService.updateStatus(e.data.bookingId, BookingStatus.AWAITING_PAYMENT, 'SEAT_LOCKED');
          break;
        }
        case TOPICS.SEAT_LOCK_FAILED: {
          const e = SeatLockFailedEventSchema.safeParse(raw);
          if (!e.success) return;
          await this.bookingsService.updateStatus(e.data.bookingId, BookingStatus.CANCELLED, 'SEAT_LOCK_FAILED');
          break;
        }
        case TOPICS.PAYMENT_COMPLETED: {
          const e = PaymentCompletedEventSchema.safeParse(raw);
          if (!e.success) return;
          await this.bookingsService.updateStatus(e.data.bookingId, BookingStatus.CONFIRMED, 'PAYMENT_CONFIRMED', {
            paymentRef: e.data.paymentRef,
          });
          break;
        }
        case TOPICS.PAYMENT_FAILED: {
          const e = PaymentFailedEventSchema.safeParse(raw);
          if (!e.success) return;
          await this.bookingsService.updateStatus(e.data.bookingId, BookingStatus.COMPENSATING, 'PAYMENT_FAILED');
          break;
        }
        default:
          this.logger.warn(`Unexpected topic: ${topic}`);
      }
    }});
  }

  async onModuleDestroy() { await this.consumer.disconnect(); }
}
