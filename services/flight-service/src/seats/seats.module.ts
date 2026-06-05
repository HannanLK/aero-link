import { Module, forwardRef } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { SeatsService } from './seats.service';
import { SeatsController } from './seats.controller';

@Module({
  imports: [forwardRef(() => KafkaModule)],
  controllers: [SeatsController],
  providers: [SeatsService],
  exports: [SeatsService],
})
export class SeatsModule {}