import { IsIn } from 'class-validator';

export class ScanDto {
  @IsIn(['CHECKED_IN', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'COLLECTED', 'LOST'])
  status: string;
}
