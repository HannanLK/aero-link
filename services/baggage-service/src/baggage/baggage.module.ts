import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { BaggageService } from './baggage.service';
import { BaggageController } from './baggage.controller';

@Module({
  imports: [KafkaModule],
  controllers: [BaggageController],
  providers: [BaggageService],
})
export class BaggageModule {}
