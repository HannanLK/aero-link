import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CorrelationIdMiddleware } from '@aerolink/common-middleware';
import { KafkaModule } from './kafka/kafka.module';
import { BaggageModule } from './baggage/baggage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule,
    BaggageModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
