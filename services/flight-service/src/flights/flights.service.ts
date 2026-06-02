import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { FlightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';
import { TOPICS, buildFlightStatusChangedEvent } from '@aerolink/events';
import { CreateFlightDto } from './dto/create-flight.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async search(dto: SearchFlightsDto) {
    // Read-side: try Redis projection first
    const cacheKey = `flights:search:${dto.origin}:${dto.destination}:${dto.date}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { source: 'cache', data: JSON.parse(cached) };
    }

    const from = new Date(dto.date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dto.date);
    to.setHours(23, 59, 59, 999);

    const flights = await this.prisma.flight.findMany({
      where: {
        origin: dto.origin.toUpperCase(),
        destination: dto.destination.toUpperCase(),
        scheduledDep: { gte: from, lte: to },
        status: { notIn: [FlightStatus.CANCELLED] },
      },
      include: { aircraft: { select: { model: true } } },
      orderBy: { scheduledDep: 'asc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(flights), 'EX', 60);
    return { source: 'db', data: flights };
  }

  async findOne(id: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: { aircraft: true },
    });
    if (!flight) throw new NotFoundException(`Flight ${id} not found`);
    return flight;
  }

  async create(dto: CreateFlightDto) {
    return this.prisma.flight.create({
      data: {
        id: uuidv4(),
        flightNumber: dto.flightNumber,
        origin: dto.origin.toUpperCase(),
        destination: dto.destination.toUpperCase(),
        scheduledDep: new Date(dto.scheduledDep),
        scheduledArr: new Date(dto.scheduledArr),
        aircraftId: dto.aircraftId,
        gate: dto.gate,
        terminal: dto.terminal,
        availableSeats: dto.availableSeats,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto, correlationId: string) {
    const flight = await this.findOne(id);
    const updated = await this.prisma.flight.update({
      where: { id },
      data: { status: dto.status as FlightStatus, gate: dto.gate, terminal: dto.terminal },
    });

    await this.kafka.emit(
      TOPICS.FLIGHT_STATUS_CHANGED,
      id,
      buildFlightStatusChangedEvent({
        flightId: id,
        flightNumber: flight.flightNumber,
        previousStatus: flight.status,
        newStatus: dto.status as FlightStatus,
        correlationId,
      }),
    );

    // Invalidate search cache for this route
    const dateStr = flight.scheduledDep.toISOString().split('T')[0];
    await this.redis.del(`flights:search:${flight.origin}:${flight.destination}:${dateStr}`);

    return updated;
  }

  async getManifest(id: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: {
        seats: { where: { isAvailable: false }, select: { seatNumber: true, lockedBy: true } },
      },
    });
    if (!flight) throw new NotFoundException(`Flight ${id} not found`);
    return { flightId: id, bookedSeats: flight.seats };
  }
}
