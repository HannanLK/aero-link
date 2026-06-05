import { Module, forwardRef } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [forwardRef(() => KafkaModule)],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}