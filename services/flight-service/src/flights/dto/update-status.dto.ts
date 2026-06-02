import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FlightStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(FlightStatus)
  status: FlightStatus;

  @IsOptional()
  @IsString()
  gate?: string;

  @IsOptional()
  @IsString()
  terminal?: string;
}
