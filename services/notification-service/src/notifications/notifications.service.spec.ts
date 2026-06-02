import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

const mockConfig = {
  getOrThrow: jest.fn((k: string) => {
    switch (k) {
      case 'AWS_REGION': return 'us-east-1';
      case 'NOTIFICATION_TABLE_NAME': return 'notif-table';
      case 'SES_FROM_ADDRESS': return 'noreply@aerolink.app';
      default: return 'x';
    }
  }),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let sesSend: jest.Mock;
  let snsSend: jest.Mock;
  let dynamoSend: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
    sesSend = jest.fn().mockResolvedValue({});
    snsSend = jest.fn().mockResolvedValue({});
    dynamoSend = jest.fn().mockResolvedValue({ Items: [] });
    (service as any).ses = { send: sesSend };
    (service as any).sns = { send: snsSend };
    (service as any).dynamo = { send: dynamoSend };
    jest.clearAllMocks();
  });

  it('sends an email via SES and persists the notification', async () => {
    const result = await service.send(
      'user-1', 'BOOKING_CONFIRMED', 'EMAIL', { email: 'jane@example.com', bookingId: 'b1' },
    );

    expect(sesSend).toHaveBeenCalledTimes(1);
    expect(dynamoSend).toHaveBeenCalledTimes(1); // PutCommand
    expect(result.type).toBe('BOOKING_CONFIRMED');
    expect(result.channel).toBe('EMAIL');
    expect(result.notificationId).toBeDefined();
  });

  it('sends an SMS via SNS when channel is SMS', async () => {
    await service.send('user-1', 'FLIGHT_STATUS_CHANGED', 'SMS', { phone: '+15551234567' });
    expect(snsSend).toHaveBeenCalledTimes(1);
    expect(sesSend).not.toHaveBeenCalled();
  });

  it('still records the notification when no contact detail is supplied', async () => {
    const result = await service.send('user-1', 'PAYMENT_CONFIRMED', 'EMAIL', {});
    expect(sesSend).not.toHaveBeenCalled();
    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expect(result.notificationId).toBeDefined();
  });

  it('returns history from DynamoDB', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [{ notificationId: 'n1' }] });
    const history = await service.getHistory('user-1');
    expect(history).toEqual([{ notificationId: 'n1' }]);
  });
});
