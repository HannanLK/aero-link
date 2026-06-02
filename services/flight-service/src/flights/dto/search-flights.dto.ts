import { IsString, Length, IsDateString } from 'class-validator';

export class SearchFlightsDto {
  @IsString()
  @Length(3, 3)
  origin: string;

  @IsString()
  @Length(3, 3)
  destination: string;

  @IsDateString()
  date: string;
}
