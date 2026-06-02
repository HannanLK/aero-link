import { IsUUID, IsString, IsNumber, IsPositive, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Booking this payment settles' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ example: 349.99, description: 'Amount to charge' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ example: 'pm_card_visa', description: 'Stripe PaymentMethod id (only last-4 is persisted — PCI-DSS)' })
  @IsString()
  @Length(1, 64)
  stripePaymentMethodId: string;
}
