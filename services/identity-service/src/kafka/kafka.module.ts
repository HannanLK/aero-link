import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Module({
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
        clientId: 'identity-service',
      }),
    },
    KafkaService,
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
