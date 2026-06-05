import { Module, forwardRef } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  imports: [forwardRef(() => KafkaModule)],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}