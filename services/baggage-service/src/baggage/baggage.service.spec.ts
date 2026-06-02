import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaggageService } from './baggage.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS } from '@aerolink/events';

const mockKafka = { emit: jest.fn().mockResolvedValue(undefined) };
const mockConfig = {
  get: jest.fn(() => undefined),
  getOrThrow: jest.fn((k: string) => (k === 'AWS_REGION' ? 'us-east-1' : 'bags-table')),
};

function makeBag(status: string) {
  return { bagId: 'bag-1', barcode: 'BAG-ABCD', bookingId: 'booking-1', flightId: 'flight-1', status };
}

describe('BaggageService (status FSM)', () => {
  let service: BaggageService;
  let send: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaggageService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: KafkaProducerService, useValue: mockKafka },
      ],
    }).compile();
    service = module.get<BaggageService>(BaggageService);
    send = jest.fn();
    // Replace the real DynamoDB document client with a mock.
    (service as any).dynamo = { send };
    jest.clearAllMocks();
  });

  it('allows a valid transition (TAGGED → CHECKED_IN) and emits an event', async () => {
    send
      .mockResolvedValueOnce({ Items: [makeBag('TAGGED')] }) // getByBarcode query
      .mockResolvedValueOnce({}); // update

    const result: any = await service.updateStatus('BAG-ABCD', 'CHECKED_IN' as any, 'handler-1', 'corr-1');

    expect(result.status).toBe('CHECKED_IN');
    expect(mockKafka.emit).toHaveBeenCalledWith(
      TOPICS.BAGGAGE_STATUS_UPDATED,
      'bag-1',
      expect.objectContaining({ previousStatus: 'TAGGED', newStatus: 'CHECKED_IN' }),
    );
  });

  it('rejects an illegal transition (TAGGED → LOADED)', async () => {
    send.mockResolvedValueOnce({ Items: [makeBag('TAGGED')] });
    await expect(
      service.updateStatus('BAG-ABCD', 'LOADED' as any, 'handler-1', 'corr-1'),
    ).rejects.toThrow(ConflictException);
    expect(mockKafka.emit).not.toHaveBeenCalled();
  });

  it('rejects any transition out of a terminal state (COLLECTED)', async () => {
    send.mockResolvedValueOnce({ Items: [makeBag('COLLECTED')] });
    await expect(
      service.updateStatus('BAG-ABCD', 'LOST' as any, 'handler-1', 'corr-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFound when the barcode is unknown', async () => {
    send.mockResolvedValueOnce({ Items: [] });
    await expect(service.scan('NOPE')).rejects.toThrow(NotFoundException);
  });
});
