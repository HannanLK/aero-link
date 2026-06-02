import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BaggageService } from './baggage.service';
import { ScanDto } from './dto/scan.dto';
import { RolesGuard, Roles, CurrentUser, JwtPayload } from '@aerolink/common-middleware';

@ApiTags('baggage')
@ApiBearerAuth('access-token')
@Controller('baggage')
@UseGuards(RolesGuard)
export class BaggageController {
  constructor(private readonly baggageService: BaggageService) {}

  /** Look up a single bag by its barcode. */
  @Get(':barcode')
  @ApiOperation({ summary: 'Look up a bag by barcode' })
  @ApiParam({ name: 'barcode', example: 'BAG-1A2B3C4D' })
  @Roles('BAGGAGE_HANDLER', 'GATE_AGENT', 'FLIGHT_OPS', 'ADMIN')
  scan(@Param('barcode') barcode: string) {
    return this.baggageService.scan(barcode);
  }

  /** Record a scan event that advances a bag through its status FSM. */
  @Post(':barcode/scan')
  @ApiOperation({ summary: 'Record a baggage scan (advances FSM state)' })
  @ApiParam({ name: 'barcode', example: 'BAG-1A2B3C4D' })
  @Roles('BAGGAGE_HANDLER', 'GATE_AGENT', 'ADMIN')
  recordScan(
    @Param('barcode') barcode: string,
    @Body() dto: ScanDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.baggageService.updateStatus(barcode, dto.status as any, user.sub, correlationId);
  }

  /** Update bag status directly by bag id (handler / admin override). */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update bag status by bag id' })
  @Roles('BAGGAGE_HANDLER', 'GATE_AGENT', 'ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: ScanDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.baggageService.updateStatus(id, dto.status as any, user.sub, correlationId);
  }

  /** List all bags for a booking. */
  @Get('by-booking/:bookingId')
  @ApiOperation({ summary: 'List bags for a booking' })
  @Roles('PASSENGER', 'BAGGAGE_HANDLER', 'GATE_AGENT', 'ADMIN')
  getByBooking(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.baggageService.getByBooking(bookingId);
  }

  /** List all bags loaded on a flight. */
  @Get('by-flight/:flightId')
  @ApiOperation({ summary: 'List bags on a flight' })
  @Roles('BAGGAGE_HANDLER', 'GATE_AGENT', 'FLIGHT_OPS', 'ADMIN')
  getByFlight(@Param('flightId', ParseUUIDPipe) flightId: string) {
    return this.baggageService.getByFlight(flightId);
  }
}
