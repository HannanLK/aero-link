import { Injectable, Inject, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';
import { TOPICS, buildSeatLockConfirmedEvent, buildSeatLockFailedEvent } from '@aerolink/events';
import { v4 as uuidv4 } from 'uuid';

const SEAT_LOCK_TTL_SECONDS = 900; // 15 minutes

@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async lockSeat(flightId: string, seatNumber: string, bookingId: string, correlationId: string): Promise<void> {
    const redisKey = `seat-lock:${flightId}:${seatNumber}`;
    // Atomic SET NX — only one booking wins the lock
    const acquired = await this.redis.set(redisKey, bookingId, 'EX', SEAT_LOCK_TTL_SECONDS, 'NX');

    if (!acquired) {
      this.logger.warn(`Seat ${seatNumber} on flight ${flightId} already locked`);
      await this.kafka.emit(
        TOPICS.SEAT_LOCK_FAILED,
        bookingId,
        buildSeatLockFailedEvent({ bookingId, flightId, seatNumber, reason: 'SEAT_ALREADY_LOCKED', correlationId }),
      );
      return;
    }

    // Persist lock in write-side DB
    await this.prisma.seat.updateMany({
      where: { flightId, seatNumber, isAvailable: true },
      data: { isAvailable: false, lockedBy: bookingId, lockedUntil: new Date(Date.now() + SEAT_LOCK_TTL_SECONDS * 1000) },
    });

    await this.kafka.emit(
      TOPICS.SEAT_LOCK_CONFIRMED,
      bookingId,
      buildSeatLockConfirmedEvent({ eventId: uuidv4(), bookingId, flightId, seatNumber, correlationId }),
    );

    // Invalidate Redis flight projection cache
    await this.redis.del(`flight:${flightId}:seat-map`);
    this.logger.log(`Seat ${seatNumber} locked for booking ${bookingId}`);
  }

  async releaseSeat(flightId: string, seatNumber: string, bookingId: string): Promise<void> {
    const redisKey = `seat-lock:${flightId}:${seatNumber}`;
    const currentHolder = await this.redis.get(redisKey);
    if (currentHolder === bookingId) {
      await this.redis.del(redisKey);
    }

    await this.prisma.seat.updateMany({
      where: { flightId, seatNumber, lockedBy: bookingId },
      data: { isAvailable: true, lockedBy: null, lockedUntil: null },
    });

    await this.redis.del(`flight:${flightId}:seat-map`);
    this.logger.log(`Seat ${seatNumber} released (booking ${bookingId})`);
  }

  async getSeatMap(flightId: string) {
    const cacheKey = `flight:${flightId}:seat-map`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { source: 'cache', data: JSON.parse(cached) };

    const seats = await this.prisma.seat.findMany({
      where: { flightId },
      select: { seatNumber: true, class: true, isAvailable: true },
      orderBy: { seatNumber: 'asc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(seats), 'EX', 60);
    return { source: 'db', data: seats };
  }
}
