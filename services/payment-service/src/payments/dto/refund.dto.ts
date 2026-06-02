import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefundDto {
  @ApiPropertyOptional({ example: 'PASSENGER_REQUESTED', description: 'Reason for the refund' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
