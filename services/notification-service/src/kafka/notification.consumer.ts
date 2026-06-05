import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { createKafka, ensureTopics } from '@aerolink/common-middleware';
import { TOPICS } from '@aerolink/events';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Reacts to domain events across the platform and dispatches passenger
 * notifications (email via SES / SMS via SNS, persisted in DynamoDB).
 * Consumer group must match the KEDA ScaledObject ('notification-service-group').
 */
@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private consumer: Consumer;
  private kafkaInstance: Kafka;

  constructor(
    @Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string; groupId: string },
    private readonly notifications: NotificationsService,
  ) {
    this.kafkaInstance = createKafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.consumer = this.kafkaInstance.consumer({ groupId: this.config.groupId });
  }

  async onModuleInit() {
    const topics = [
      TOPICS.USER_REGISTERED,
      TOPICS.BOOKING_CONFIRMED,
      TOPICS.PAYMENT_COMPLETED,
      TOPICS.CHECKIN_COMPLETED,
      TOPICS.FLIGHT_STATUS_CHANGED,
      TOPICS.BAGGAGE_STATUS_UPDATED,
    ];
    await ensureTopics(this.kafkaInstance, topics);
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        // Parsed leniently from the raw event envelope (fields are read directly
        // rather than via strict schema validation, so notifications are never
        // dropped on a minor contract drift).
        const e: any = JSON.parse(message.value?.toString() ?? '{}');
        try {
          await this.handle(topic, e);
        } catch (err) {
          this.logger.error(`Failed to handle ${topic}: ${(err as Error).message}`);
        }
      },
    });
  }

  private async handle(topic: string, e: any): Promise<void> {
    switch (topic) {
      case TOPICS.USER_REGISTERED:
        await this.notifications.send(e.userId, 'WELCOME', 'EMAIL', { email: e.email });
        break;

      case TOPICS.BOOKING_CONFIRMED:
        await this.notifications.send(e.passengerId, 'BOOKING_CONFIRMED', 'EMAIL', {
          bookingId: e.bookingId, flightNumber: e.flightNumber, seatNumber: e.seatNumber,
        });
        break;

      case TOPICS.PAYMENT_COMPLETED:
        await this.notifications.send(e.passengerId, 'PAYMENT_CONFIRMED', 'EMAIL', {
          bookingId: e.bookingId, amount: e.amount,
        });
        break;

      case TOPICS.CHECKIN_COMPLETED:
        await this.notifications.send(e.passengerId, 'CHECKIN_COMPLETE', 'EMAIL', {
          bookingId: e.bookingId, flightNumber: e.flightNumber, seatNumber: e.seatNumber, gate: e.gate,
        });
        break;

      case TOPICS.FLIGHT_STATUS_CHANGED:
        // Broadcast-style event (no single passenger) — keyed by flight.
        await this.notifications.send(e.flightId, 'FLIGHT_STATUS_CHANGED', 'PUSH', {
          flightNumber: e.flightNumber, newStatus: e.newStatus,
        });
        break;

      case TOPICS.BAGGAGE_STATUS_UPDATED:
        if (e.newStatus === 'ARRIVED' || e.newStatus === 'DELIVERED') {
          await this.notifications.send(e.passengerId, 'BAGGAGE_ARRIVED', 'EMAIL', {
            bagId: e.bagId, barcode: e.barcode, bookingId: e.bookingId,
          });
        }
        break;

      default:
        this.logger.warn(`Unexpected topic: ${topic}`);
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
