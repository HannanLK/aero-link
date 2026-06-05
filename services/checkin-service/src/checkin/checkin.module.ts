import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';

@Module({
  imports: [KafkaModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
