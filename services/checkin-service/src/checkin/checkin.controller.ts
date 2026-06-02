import { Controller, Post, Get, Param, ParseUUIDPipe, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CheckinService } from './checkin.service';
import { CheckinDto } from './dto/checkin.dto';
import { RolesGuard, Roles, CurrentUser, JwtPayload } from '@aerolink/common-middleware';

@ApiTags('checkin')
@ApiBearerAuth('access-token')
@Controller('checkin')
@UseGuards(RolesGuard)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post()
  @Roles('PASSENGER', 'CHECK_IN_STAFF', 'GATE_AGENT', 'ADMIN')
  checkin(
    @Body() dto: CheckinDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.checkinService.checkin(dto, user.sub, correlationId);
  }

  @Get(':bookingId')
  @Roles('PASSENGER', 'CHECK_IN_STAFF', 'GATE_AGENT', 'ADMIN')
  findOne(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.checkinService.findOne(bookingId);
  }

  @Get(':bookingId/boarding-pass/qr')
  @Roles('PASSENGER', 'CHECK_IN_STAFF', 'GATE_AGENT', 'ADMIN')
  getBoardingPassQr(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.checkinService.getBoardingPassQr(bookingId).then((qrCode) => ({ qrCode }));
  }

  @Post(':bookingId/board')
  @Roles('GATE_AGENT', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  board(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.checkinService.board(bookingId, correlationId);
  }
}
