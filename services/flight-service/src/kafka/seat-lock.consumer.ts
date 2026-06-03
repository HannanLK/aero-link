import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { createKafka } from '@aerolink/common-middleware';
import { TOPICS, BookingCreatedEventSchema } from '@aerolink/events';
import { SeatsService } from '../seats/seats.service';

@Injectable()
export class SeatLockConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeatLockConsumer.name);
  private consumer: Consumer;

  constructor(
    @Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string; groupId: string },
    private readonly seatsService: SeatsService,
  ) {
    const kafka = createKafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.consumer = kafka.consumer({ groupId: this.config.groupId });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPICS.BOOKING_CREATED, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const raw = JSON.parse(message.value?.toString() ?? '{}');
        const parsed = BookingCreatedEventSchema.safeParse(raw);
        if (!parsed.success) {
          this.logger.warn('Invalid BookingCreated event', parsed.error.message);
          return;
        }
        const { bookingId, flightId, seatNumber, correlationId } = parsed.data;
        await this.seatsService.lockSeat(flightId, seatNumber, bookingId, correlationId);
      },
    });
  }

  async onModuleDestroy() { await this.consumer.disconnect(); }
}
