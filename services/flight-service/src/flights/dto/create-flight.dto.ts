import { IsString, Length, IsDateString, IsUUID, IsInt, Min, IsOptional } from 'class-validator';

export class CreateFlightDto {
  @IsString()
  @Length(2, 10)
  flightNumber: string;

  @IsString()
  @Length(3, 3)
  origin: string;

  @IsString()
  @Length(3, 3)
  destination: string;

  @IsDateString()
  scheduledDep: string;

  @IsDateString()
  scheduledArr: string;

  @IsUUID()
  aircraftId: string;

  @IsInt()
  @Min(1)
  availableSeats: number;

  @IsOptional()
  @IsString()
  gate?: string;

  @IsOptional()
  @IsString()
  terminal?: string;
}
