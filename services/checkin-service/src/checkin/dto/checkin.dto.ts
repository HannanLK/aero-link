import { IsUUID, IsString, Length, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CheckinDto {
  @IsUUID()
  bookingId: string;

  @IsUUID()
  flightId: string;

  @IsString()
  @Length(1, 10)
  seatNumber: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  bagCount?: number;
}
