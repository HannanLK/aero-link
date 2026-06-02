import { IsUUID, IsString, Length, IsNumber, IsPositive, IsOptional, IsIn } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  flightId: string;

  @IsString()
  @Length(1, 10)
  seatNumber: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAmount: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
