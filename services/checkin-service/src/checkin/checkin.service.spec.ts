import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS } from '@aerolink/events';

const mockPrisma = {
  checkin: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};
const mockKafka = { emit: jest.fn().mockResolvedValue(undefined) };
// LAMBDA_QR_DISABLED=true → generateQR returns a local placeholder, no AWS call.
const mockConfig = { get: jest.fn((k: string) => (k === 'LAMBDA_QR_DISABLED' ? 'true' : undefined)) };

const dto = {
  bookingId: '22222222-2222-2222-2222-222222222222',
  flightId: '11111111-1111-1111-1111-111111111111',
  seatNumber: '14A',
  bagCount: 2,
};

describe('CheckinService', () => {
  let service: CheckinService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KafkaProducerService, useValue: mockKafka },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<CheckinService>(CheckinService);
    jest.clearAllMocks();
  });

  describe('checkin', () => {
    it('issues a boarding pass, emits CHECKIN_COMPLETED, and creates a tag per bag', async () => {
      mockPrisma.checkin.findUnique.mockResolvedValue(null);
      mockPrisma.checkin.upsert.mockResolvedValue({ bookingId: dto.bookingId, status: 'BOARDING_PASS_ISSUED' });

      const result: any = await service.checkin(dto as any, 'passenger-1', 'corr-1');

      expect(result.status).toBe('BOARDING_PASS_ISSUED');
      // 1 CHECKIN_COMPLETED + 2 BAGGAGE_TAG_CREATED
      expect(mockKafka.emit).toHaveBeenCalledWith(TOPICS.CHECKIN_COMPLETED, dto.bookingId, expect.any(Object));
      const tagCalls = mockKafka.emit.mock.calls.filter((c) => c[0] === TOPICS.BAGGAGE_TAG_CREATED);
      expect(tagCalls).toHaveLength(2);
    });

    it('rejects a second check-in for the same booking', async () => {
      mockPrisma.checkin.findUnique.mockResolvedValue({ bookingId: dto.bookingId, status: 'BOARDING_PASS_ISSUED' });
      await expect(service.checkin(dto as any, 'passenger-1', 'corr-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('board', () => {
    it('transitions an issued boarding pass to BOARDED', async () => {
      mockPrisma.checkin.findUnique.mockResolvedValue({ bookingId: dto.bookingId, status: 'BOARDING_PASS_ISSUED' });
      mockPrisma.checkin.update.mockResolvedValue({ bookingId: dto.bookingId, status: 'BOARDED' });
      const result: any = await service.board(dto.bookingId, 'corr-1');
      expect(result.status).toBe('BOARDED');
    });

    it('rejects boarding from an invalid status', async () => {
      mockPrisma.checkin.findUnique.mockResolvedValue({ bookingId: dto.bookingId, status: 'NOT_CHECKED_IN' });
      await expect(service.board(dto.bookingId, 'corr-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getBoardingPassQr', () => {
    it('throws NotFound when no check-in exists', async () => {
      mockPrisma.checkin.findUnique.mockResolvedValue(null);
      await expect(service.getBoardingPassQr('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
