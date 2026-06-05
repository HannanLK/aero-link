import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  controllers: [PaymentsController],
  imports: [KafkaModule],
  providers: [PaymentsService],
})
export class PaymentsModule {}
