import { Test, TestingModule } from '@nestjs/testing';
import { SeatsService } from './seats.service';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TOPICS } from '@aerolink/events';

const mockPrisma = { seat: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn() } };
const mockKafka = { emit: jest.fn().mockResolvedValue(undefined) };
const mockRedis = { set: jest.fn(), get: jest.fn(), del: jest.fn().mockResolvedValue(1) };

describe('SeatsService (distributed seat lock)', () => {
  let service: SeatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KafkaProducerService, useValue: mockKafka },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<SeatsService>(SeatsService);
    jest.clearAllMocks();
  });

  describe('lockSeat', () => {
    it('confirms the lock when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await service.lockSeat('flight-1', '14A', 'booking-1', 'corr-1');

      // Atomic acquire with NX + TTL
      expect(mockRedis.set).toHaveBeenCalledWith('seat-lock:flight-1:14A', 'booking-1', 'EX', 900, 'NX');
      expect(mockPrisma.seat.updateMany).toHaveBeenCalled();
      expect(mockKafka.emit).toHaveBeenCalledWith(TOPICS.SEAT_LOCK_CONFIRMED, 'booking-1', expect.any(Object));
      expect(mockRedis.del).toHaveBeenCalledWith('flight:flight-1:seat-map'); // cache invalidation
    });

    it('fails the lock (no DB write) when the seat is already held', async () => {
      mockRedis.set.mockResolvedValue(null); // NX lost the race
      await service.lockSeat('flight-1', '14A', 'booking-2', 'corr-1');

      expect(mockKafka.emit).toHaveBeenCalledWith(TOPICS.SEAT_LOCK_FAILED, 'booking-2', expect.any(Object));
      expect(mockPrisma.seat.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('releaseSeat', () => {
    it('deletes the redis lock only when held by the same booking', async () => {
      mockRedis.get.mockResolvedValue('booking-1');
      await service.releaseSeat('flight-1', '14A', 'booking-1');
      expect(mockRedis.del).toHaveBeenCalledWith('seat-lock:flight-1:14A');
      expect(mockPrisma.seat.updateMany).toHaveBeenCalled();
    });

    it('does not delete a lock held by a different booking', async () => {
      mockRedis.get.mockResolvedValue('someone-else');
      await service.releaseSeat('flight-1', '14A', 'booking-1');
      expect(mockRedis.del).not.toHaveBeenCalledWith('seat-lock:flight-1:14A');
    });
  });

  describe('getSeatMap', () => {
    it('serves from cache when present', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([{ seatNumber: '1A' }]));
      const result = await service.getSeatMap('flight-1');
      expect(result.source).toBe('cache');
      expect(mockPrisma.seat.findMany).not.toHaveBeenCalled();
    });

    it('falls back to the DB and warms the cache on a miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.seat.findMany.mockResolvedValue([{ seatNumber: '1A', class: 'ECONOMY', isAvailable: true }]);
      const result = await service.getSeatMap('flight-1');
      expect(result.source).toBe('db');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });
});
