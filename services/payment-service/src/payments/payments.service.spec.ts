import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS } from '@aerolink/events';

const mockPrisma = {
  transaction: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockKafka = { emit: jest.fn().mockResolvedValue(undefined) };

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('charges, stores only card last-4 (PCI-DSS), and emits PAYMENT_COMPLETED', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrisma.transaction.update.mockImplementation(({ data }: any) => ({ id: 'tx-1', ...data }));

      const result: any = await service.processPayment(
        'booking-1', 'passenger-1', 349.99, 'USD', 'idem-1', 'corr-1', 'pm_card_4242',
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(result.cardLast4).toBe('4242');
      expect(mockKafka.emit).toHaveBeenCalledWith(
        TOPICS.PAYMENT_COMPLETED,
        'booking-1',
        expect.objectContaining({ bookingId: 'booking-1' }),
      );
    });

    it('is idempotent on the idempotency key', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({ id: 'tx-existing', status: 'SUCCEEDED' });
      const result: any = await service.processPayment(
        'booking-1', 'passenger-1', 10, 'USD', 'idem-1', 'corr-1', 'pm_card_4242',
      );
      expect(result.id).toBe('tx-existing');
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('throws NotFound when there is no succeeded charge for the booking', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.refund('booking-x', 'idem-r', 'corr-1')).rejects.toThrow(NotFoundException);
    });

    it('reverses the charge and emits PAYMENT_REFUNDED', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1', bookingId: 'booking-1', passengerId: 'passenger-1',
        amount: 349.99, currency: 'USD', status: 'SUCCEEDED',
      });
      mockPrisma.transaction.create.mockResolvedValue({ id: 'refund-1' });
      mockPrisma.transaction.update.mockResolvedValue({ id: 'tx-1', status: 'REFUNDED' });

      const result: any = await service.refund('booking-1', 'idem-r', 'corr-1', 'PASSENGER_REQUESTED');

      expect(result.id).toBe('refund-1');
      expect(mockKafka.emit).toHaveBeenCalledWith(
        TOPICS.PAYMENT_REFUNDED,
        'booking-1',
        expect.objectContaining({ refundTransactionId: 'refund-1', reason: 'PASSENGER_REQUESTED' }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound for an unknown transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
