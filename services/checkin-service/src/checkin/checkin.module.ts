import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';

@Module({
  controllers: [CheckinController],
  imports: [KafkaModule],
  providers: [CheckinService],
})
export class CheckinModule {}
