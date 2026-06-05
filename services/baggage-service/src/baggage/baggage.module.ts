import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { BaggageService } from './baggage.service';
import { BaggageController } from './baggage.controller';

@Module({
  controllers: [BaggageController],
  imports: [KafkaModule],
  providers: [BaggageService],
})
export class BaggageModule {}
