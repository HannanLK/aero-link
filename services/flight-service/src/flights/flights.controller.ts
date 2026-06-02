import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { RolesGuard, Roles } from '@aerolink/common-middleware';

@ApiTags('flights')
@ApiBearerAuth('access-token')
@Controller('flights')
@UseGuards(RolesGuard)
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  @Roles('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN')
  search(@Query() dto: SearchFlightsDto) {
    return this.flightsService.search(dto);
  }

  @Post()
  @Roles('FLIGHT_OPS', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateFlightDto) {
    return this.flightsService.create(dto);
  }

  @Get(':id')
  @Roles('PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'FLIGHT_OPS', 'ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('FLIGHT_OPS', 'GATE_AGENT', 'ADMIN')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.flightsService.updateStatus(id, dto, correlationId);
  }

  @Get(':id/manifest')
  @Roles('GATE_AGENT', 'FLIGHT_OPS', 'ADMIN')
  getManifest(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.getManifest(id);
  }
}
