import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CorrelationIdMiddleware } from '@aerolink/common-middleware';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    NotificationsModule,
    KafkaModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
