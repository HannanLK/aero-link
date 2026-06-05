import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  controllers: [FlightsController],
  imports: [KafkaModule],
  providers: [FlightsService],
})
export class FlightsModule {}
