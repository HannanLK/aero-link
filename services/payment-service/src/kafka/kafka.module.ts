import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
        clientId: 'payment-service',
        groupId: 'payment-service-group',
      }),
    },
    KafkaProducerService,
  ],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
