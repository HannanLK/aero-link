import { Controller, Post, Get, Body, Headers, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { RolesGuard, Roles, CurrentUser, JwtPayload } from '@aerolink/common-middleware';
import { IDEMPOTENCY_KEY_HEADER } from '@aerolink/shared-kernel';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('payments')
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Charge a booking via Stripe. Idempotent on the Idempotency-Key header. */
  @Post()
  @ApiOperation({ summary: 'Process a payment for a booking' })
  @ApiHeader({ name: IDEMPOTENCY_KEY_HEADER, required: true, description: 'Idempotency key' })
  @Roles('PASSENGER', 'ADMIN')
  processPayment(
    @Body() dto: ProcessPaymentDto,
    @CurrentUser() user: JwtPayload,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.paymentsService.processPayment(
      dto.bookingId, user.sub, dto.amount, dto.currency,
      idempotencyKey, correlationId, dto.stripePaymentMethodId,
    );
  }

  /** Refund the successful charge for a booking. Idempotent on the Idempotency-Key header. */
  @Post(':bookingId/refund')
  @ApiOperation({ summary: 'Refund a booking payment' })
  @ApiHeader({ name: IDEMPOTENCY_KEY_HEADER, required: true, description: 'Idempotency key' })
  @Roles('PASSENGER', 'ADMIN')
  refund(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RefundDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @Headers('x-correlation-id') correlationId: string,
  ) {
    return this.paymentsService.refund(bookingId, idempotencyKey, correlationId, dto.reason);
  }

  /** List the current user's transactions. */
  @Get()
  @ApiOperation({ summary: 'List my transactions' })
  @Roles('PASSENGER', 'ADMIN')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.findAllByPassenger(user.sub);
  }

  /** Fetch a single transaction by id. */
  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by id' })
  @Roles('PASSENGER', 'ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }
}
