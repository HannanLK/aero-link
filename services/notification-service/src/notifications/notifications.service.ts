import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';
export type NotificationType = 'WELCOME' | 'BOOKING_CONFIRMED' | 'PAYMENT_CONFIRMED' | 'CHECKIN_COMPLETE' | 'FLIGHT_STATUS_CHANGED' | 'BAGGAGE_ARRIVED';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly ses: SESClient;
  private readonly sns: SNSClient;
  // typed `any` to sidestep @aws-sdk/lib-dynamodb vs @smithy/types version skew (runtime is unaffected)
  private readonly dynamo: any;
  private readonly tableName: string;

  constructor(private readonly config: ConfigService) {
    const region = config.getOrThrow('AWS_REGION');
    this.ses = new SESClient({ region });
    this.sns = new SNSClient({ region });
    this.dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    this.tableName = config.getOrThrow('NOTIFICATION_TABLE_NAME');
  }

  async send(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    payload: Record<string, unknown>,
  ) {
    const notificationId = uuidv4();
    const now = new Date().toISOString();

    if (channel === 'EMAIL' && payload.email) {
      await this.sendEmail(payload.email as string, type, payload);
    } else if (channel === 'SMS' && payload.phone) {
      await this.sendSms(payload.phone as string, type, payload);
    }

    await this.dynamo.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        userId,
        createdAt: now,
        notificationId,
        type,
        channel,
        payload,
        sentAt: now,
      },
    }));

    return { notificationId, type, channel, sentAt: now };
  }

  async getHistory(userId: string, limit = 20) {
    const result = await this.dynamo.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: limit,
      ScanIndexForward: false,
    }));
    return result.Items ?? [];
  }

  private async sendEmail(to: string, type: NotificationType, payload: Record<string, unknown>) {
    const subject = this.buildSubject(type);
    const body = this.buildEmailBody(type, payload);

    await this.ses.send(new SendEmailCommand({
      Source: this.config.getOrThrow('SES_FROM_ADDRESS'),
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: body } },
      },
    }));
    this.logger.log(`Email sent: ${type} → ${to}`);
  }

  private async sendSms(phone: string, type: NotificationType, payload: Record<string, unknown>) {
    const message = this.buildSmsMessage(type, payload);
    await this.sns.send(new PublishCommand({
      PhoneNumber: phone,
      Message: message,
    }));
    this.logger.log(`SMS sent: ${type} → ${phone}`);
  }

  private buildSubject(type: NotificationType): string {
    const subjects: Record<NotificationType, string> = {
      WELCOME: 'Welcome to AeroLink ✈',
      BOOKING_CONFIRMED: 'Your booking is confirmed ✓',
      PAYMENT_CONFIRMED: 'Payment received',
      CHECKIN_COMPLETE: 'Check-in complete — boarding pass ready',
      FLIGHT_STATUS_CHANGED: 'Flight status update',
      BAGGAGE_ARRIVED: 'Your baggage has arrived',
    };
    return subjects[type] ?? 'AeroLink notification';
  }

  private buildEmailBody(type: NotificationType, payload: Record<string, unknown>): string {
    return `<html><body><h2>AeroLink</h2><p>${JSON.stringify(payload)}</p></body></html>`;
  }

  private buildSmsMessage(type: NotificationType, _payload: Record<string, unknown>): string {
    return `AeroLink: ${this.buildSubject(type)}`;
  }
}
