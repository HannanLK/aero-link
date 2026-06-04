import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { CheckinStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS, buildCheckinCompletedEvent, buildBaggageTagCreatedEvent } from '@aerolink/events';
import { CircuitBreakerFactory, retryWithBackoff } from '@aerolink/common-middleware';
import { CheckinDto } from './dto/checkin.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  /**
   * Circuit breaker for Lambda QR code generation.
   * - Opens after 5 failures, 30s cooldown
   * - Fallback: return a text-only boarding pass (check-in still succeeds)
   */
  private readonly lambdaQrCircuitBreaker = CircuitBreakerFactory.getOrCreate('lambda-qr', {
    failureThreshold: 5,
    cooldownMs: 30_000,
    timeoutMs: 10_000,
    successThreshold: 2,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
    private readonly config: ConfigService,
  ) {}

  async checkin(dto: CheckinDto, passengerId: string, correlationId: string) {
    const existing = await this.prisma.checkin.findUnique({ where: { bookingId: dto.bookingId } });
    if (existing && existing.status !== CheckinStatus.NOT_CHECKED_IN) {
      throw new ConflictException('Passenger already checked in for this booking');
    }

    const boardingPassPayload = JSON.stringify({
      bookingId: dto.bookingId,
      passengerId,
      flightId: dto.flightId,
      seatNumber: dto.seatNumber,
      issuedAt: new Date().toISOString(),
    });

    // Generate QR via Lambda (with circuit breaker + fallback)
    const qrBase64 = await this.generateQR(boardingPassPayload, correlationId);

    const checkin = await this.prisma.checkin.upsert({
      where: { bookingId: dto.bookingId },
      create: {
        id: uuidv4(),
        bookingId: dto.bookingId,
        passengerId,
        flightId: dto.flightId,
        seatNumber: dto.seatNumber,
        status: CheckinStatus.BOARDING_PASS_ISSUED,
        boardingPass: { payload: boardingPassPayload },
        qrCode: qrBase64,
        bagCount: dto.bagCount ?? 0,
        checkedInAt: new Date(),
      },
      update: {
        status: CheckinStatus.BOARDING_PASS_ISSUED,
        qrCode: qrBase64,
        bagCount: dto.bagCount ?? 0,
        checkedInAt: new Date(),
      },
    });

    await this.kafka.emit(TOPICS.CHECKIN_COMPLETED, dto.bookingId, buildCheckinCompletedEvent({
      bookingId: dto.bookingId,
      passengerId,
      flightId: dto.flightId,
      seatNumber: dto.seatNumber,
      correlationId,
    }));

    // Create baggage tags if bags declared
    for (let i = 0; i < (dto.bagCount ?? 0); i++) {
      const barcode = `BAG-${uuidv4().split('-')[0].toUpperCase()}`;
      await this.kafka.emit(TOPICS.BAGGAGE_TAG_CREATED, dto.bookingId, buildBaggageTagCreatedEvent({
        bookingId: dto.bookingId,
        passengerId,
        flightId: dto.flightId,
        barcode,
        correlationId,
      }));
    }

    return checkin;
  }

  async findOne(bookingId: string) {
    const checkin = await this.prisma.checkin.findUnique({ where: { bookingId } });
    if (!checkin) throw new NotFoundException(`No checkin for booking ${bookingId}`);
    return checkin;
  }

  async getBoardingPassQr(bookingId: string): Promise<string> {
    const checkin = await this.findOne(bookingId);
    if (!checkin.qrCode) throw new NotFoundException('QR code not generated yet');
    return checkin.qrCode;
  }

  async board(bookingId: string, correlationId: string) {
    const checkin = await this.findOne(bookingId);
    if (checkin.status === CheckinStatus.BOARDED) return checkin;
    if (checkin.status !== CheckinStatus.BOARDING_PASS_ISSUED) {
      throw new ConflictException(`Cannot board from status ${checkin.status}`);
    }
    return this.prisma.checkin.update({
      where: { bookingId },
      data: { status: CheckinStatus.BOARDED, boardedAt: new Date() },
    });
  }

  private async generateQR(payload: string, _correlationId: string): Promise<string> {
    // Local dev fallback: skip Lambda and return a placeholder 1×1 transparent PNG
    if (this.config.get<string>('LAMBDA_QR_DISABLED') === 'true') {
      return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    return this.lambdaQrCircuitBreaker.execute(
      () =>
        retryWithBackoff(
          async () => {
            const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
            const lambda = new LambdaClient({ region: this.config.getOrThrow('AWS_REGION') });
            const result = await lambda.send(new InvokeCommand({
              FunctionName: this.config.getOrThrow('LAMBDA_QR_FUNCTION_NAME'),
              Payload: Buffer.from(JSON.stringify({ body: JSON.stringify({ type: 'boarding-pass', payload }) })),
            }));
            const text = new TextDecoder().decode(result.Payload);
            const response = JSON.parse(text);
            const body = JSON.parse(response.body);
            return body.imageBase64 as string;
          },
          { maxRetries: 2, baseDelayMs: 500, operationName: 'lambda-qr-invoke' },
        ),
      // Fallback when circuit is OPEN: return a text-based placeholder
      // Check-in still succeeds — QR can be regenerated later
      async () => {
        this.logger.warn('Lambda QR circuit OPEN — using text fallback for boarding pass');
        return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      },
    );
  }

  /** Expose circuit breaker metrics for the admin health endpoint */
  getCircuitBreakerMetrics() {
    return CircuitBreakerFactory.getAllMetrics();
  }
}
