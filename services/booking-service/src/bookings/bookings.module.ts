import { Module } from '@nestjs/common';\nimport { KafkaModule } from '../kafka/kafka.module';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

@Module({
  controllers: [BookingsController],
  imports: [KafkaModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
