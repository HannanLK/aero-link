import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationConsumer } from './notification.consumer';

@Module({
  imports: [NotificationsModule],
  providers: [
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
        clientId: 'notification-service',
        groupId: 'notification-service-group',
      }),
    },
    NotificationConsumer,
  ],
})
export class KafkaModule {}
