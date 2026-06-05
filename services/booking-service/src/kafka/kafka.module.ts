import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';
import { SagaConsumer } from './saga.consumer';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [forwardRef(() => BookingsModule)],
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
        clientId: 'booking-service',
        groupId: 'booking-service-group',
      }),
    },
    KafkaProducerService,
    SagaConsumer,
  ],
  exports: [KafkaProducerService],
})
export class KafkaModule {}