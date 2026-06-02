import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';
import { SeatLockConsumer } from './seat-lock.consumer';

@Module({
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
        clientId: 'flight-service',
        groupId: 'flight-service-group',
      }),
    },
    KafkaProducerService,
    SeatLockConsumer,
  ],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
