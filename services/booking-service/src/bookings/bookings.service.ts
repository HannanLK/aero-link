import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS, buildBookingCreatedEvent } from '@aerolink/events';
import { CreateBookingDto } from './dto/create-booking.dto';
import { v4 as uuidv4 } from 'uuid';
import { IDEMPOTENCY_KEY_HEADER } from '@aerolink/shared-kernel';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async create(dto: CreateBookingDto, passengerId: string, idempotencyKey: string, correlationId: string) {
    // Idempotency: return existing booking if key already used
    const existing = await this.prisma.booking.findUnique({ where: { idempotencyKey } });
    if (existing) {
      this.logger.log(`Idempotent return for key ${idempotencyKey}`);
      return existing;
    }

    const booking = await this.prisma.booking.create({
      data: {
        id: uuidv4(),
        idempotencyKey,
        passengerId,
        flightId: dto.flightId,
        seatNumber: dto.seatNumber,
        status: BookingStatus.AWAITING_SEAT_LOCK,
        totalAmount: dto.totalAmount,
        currency: dto.currency ?? 'USD',
        sagaHistory: [{ step: 'BOOKING_CREATED', at: new Date().toISOString() }],
      },
    });

    // Kick off the saga by publishing BookingCreated
    await this.kafka.emit(
      TOPICS.BOOKING_CREATED,
      booking.id,
      buildBookingCreatedEvent({
        bookingId: booking.id,
        passengerId,
        flightId: dto.flightId,
        seatNumber: dto.seatNumber,
        totalAmount: { amount: Number(dto.totalAmount), currency: booking.currency },
        correlationId,
      }),
    );

    return booking;
  }

  async findAll(passengerId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { passengerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where: { passengerId } }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string, passengerId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    if (booking.passengerId !== passengerId) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async cancel(id: string, passengerId: string, correlationId: string) {
    const booking = await this.findOne(id, passengerId);

    if ([BookingStatus.CANCELLED, BookingStatus.COMPENSATING].includes(booking.status)) {
      return booking;
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.COMPENSATING,
        cancelReason: 'PASSENGER_REQUESTED',
        sagaHistory: { push: { step: 'CANCEL_REQUESTED', at: new Date().toISOString() } } as any,
      },
    });

    await this.kafka.emit(
      TOPICS.BOOKING_CANCELLED,
      id,
      {
        eventId: uuidv4(),
        eventType: 'BookingCancelled',
        occurredAt: new Date().toISOString(),
        correlationId,
        version: 1,
        bookingId: id,
        passengerId,
        flightId: booking.flightId,
        seatNumber: booking.seatNumber,
        reason: 'PASSENGER_REQUESTED',
      },
    );

    return updated;
  }

  async getStatus(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, sagaHistory: true, updatedAt: true },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  // Called by saga consumers to advance state
  async updateStatus(id: string, status: BookingStatus, step: string, extra?: Record<string, unknown>) {
    return this.prisma.booking.update({
      where: { id },
      data: {
        status,
        ...extra,
        sagaHistory: { push: { step, at: new Date().toISOString() } } as any,
      },
    });
  }
}
