import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SeatsService } from './seats.service';
import { RolesGuard, Roles } from '@aerolink/common-middleware';

@ApiTags('seats')
@ApiBearerAuth('access-token')
@Controller('flights/:flightId/seats')
@UseGuards(RolesGuard)
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get()
  @Roles('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN')
  getSeatMap(@Param('flightId', ParseUUIDPipe) flightId: string) {
    return this.seatsService.getSeatMap(flightId);
  }
}
