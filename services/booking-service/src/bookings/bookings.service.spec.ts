import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS } from '@aerolink/events';

const mockPrisma = {
  booking: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockKafka = { emit: jest.fn().mockResolvedValue(undefined) };

const dto = {
  flightId: '11111111-1111-1111-1111-111111111111',
  seatNumber: '14A',
  totalAmount: 349.99,
  currency: 'USD',
};

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();
    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('starts the saga: persists booking and emits BOOKING_CREATED', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        currency: 'USD',
        status: 'AWAITING_SEAT_LOCK',
      });

      const result = await service.create(dto as any, 'passenger-1', 'idem-key-1', 'corr-1');

      expect(result.id).toBe('booking-1');
      expect(mockPrisma.booking.create).toHaveBeenCalledTimes(1);
      expect(mockKafka.emit).toHaveBeenCalledTimes(1);
      expect(mockKafka.emit).toHaveBeenCalledWith(
        TOPICS.BOOKING_CREATED,
        'booking-1',
        expect.objectContaining({ bookingId: 'booking-1' }),
      );
    });

    it('is idempotent: returns existing booking and does not emit again', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'existing', status: 'CONFIRMED' });

      const result = await service.create(dto as any, 'passenger-1', 'idem-key-1', 'corr-1');

      expect(result.id).toBe('existing');
      expect(mockPrisma.booking.create).not.toHaveBeenCalled();
      expect(mockKafka.emit).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the booking does not exist', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', 'passenger-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the booking belongs to another passenger', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b1', passengerId: 'someone-else' });
      await expect(service.findOne('b1', 'passenger-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the booking for its owner', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b1', passengerId: 'passenger-1' });
      const result = await service.findOne('b1', 'passenger-1');
      expect(result.id).toBe('b1');
    });
  });

  describe('cancel', () => {
    it('emits a compensation event when cancelling an active booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1', passengerId: 'passenger-1', flightId: 'f1', seatNumber: '14A', status: 'CONFIRMED',
      });
      mockPrisma.booking.update.mockResolvedValue({ id: 'b1', status: 'COMPENSATING' });

      const result = await service.cancel('b1', 'passenger-1', 'corr-1');

      expect(result.status).toBe('COMPENSATING');
      expect(mockKafka.emit).toHaveBeenCalledWith(
        TOPICS.BOOKING_CANCELLED,
        'b1',
        expect.objectContaining({ bookingId: 'b1', reason: 'PASSENGER_REQUESTED' }),
      );
    });

    it('is a no-op when the booking is already cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1', passengerId: 'passenger-1', status: 'CANCELLED',
      });
      const result = await service.cancel('b1', 'passenger-1', 'corr-1');
      expect(result.status).toBe('CANCELLED');
      expect(mockKafka.emit).not.toHaveBeenCalled();
      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('throws NotFound for an unknown booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
