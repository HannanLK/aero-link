import {
  Controller, Post, Get, Delete, Body, Param, Query, Headers,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RolesGuard, Roles, CurrentUser, JwtPayload } from '@aerolink/common-middleware';
import { IDEMPOTENCY_KEY_HEADER } from '@aerolink/shared-kernel';

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
@UseGuards(RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('PASSENGER', 'GATE_AGENT', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.bookingsService.create(dto, user.sub, idempotencyKey, correlationId);
  }

  @Get()
  @Roles('PASSENGER', 'GATE_AGENT', 'ADMIN')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.bookingsService.findAll(user.sub, Number(page), Number(limit));
  }

  @Get(':id')
  @Roles('PASSENGER', 'GATE_AGENT', 'ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.findOne(id, user.sub);
  }

  @Get(':id/status')
  @Roles('PASSENGER', 'GATE_AGENT', 'ADMIN')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.getStatus(id);
  }

  @Delete(':id')
  @Roles('PASSENGER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.bookingsService.cancel(id, user.sub, correlationId);
  }
}
