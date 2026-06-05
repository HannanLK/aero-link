import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { SeatsService } from './seats.service';
import { SeatsController } from './seats.controller';

@Module({
  controllers: [SeatsController],
  imports: [KafkaModule],
  providers: [SeatsService],
  exports: [SeatsService],
})
export class SeatsModule {}
