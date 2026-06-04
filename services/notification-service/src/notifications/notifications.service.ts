import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CircuitBreakerFactory, retryWithBackoff } from '@aerolink/common-middleware';
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

  /**
   * Circuit breakers for external notification providers.
   * - SES: Opens after 5 failures, 120s cooldown (email delivery is non-critical)
   * - SNS: Opens after 5 failures, 120s cooldown (SMS is non-critical)
   * Notifications are persisted to DynamoDB regardless of delivery status,
   * allowing for retry via a dead-letter processor later.
   */
  private readonly sesCircuitBreaker = CircuitBreakerFactory.getOrCreate('ses-email', {
    failureThreshold: 5,
    cooldownMs: 120_000,
    timeoutMs: 10_000,
    successThreshold: 2,
  });

  private readonly snsCircuitBreaker = CircuitBreakerFactory.getOrCreate('sns-sms', {
    failureThreshold: 5,
    cooldownMs: 120_000,
    timeoutMs: 10_000,
    successThreshold: 2,
  });

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
    let deliveryStatus: 'SENT' | 'FAILED' | 'CIRCUIT_OPEN' = 'SENT';

    try {
      if (channel === 'EMAIL' && payload.email) {
        await this.sendEmail(payload.email as string, type, payload);
      } else if (channel === 'SMS' && payload.phone) {
        await this.sendSms(payload.phone as string, type, payload);
      }
    } catch (err) {
      // Log but don't throw — notifications are non-critical to the booking saga
      const errMsg = (err as Error).message;
      deliveryStatus = errMsg.includes('OPEN') ? 'CIRCUIT_OPEN' : 'FAILED';
      this.logger.warn(`Notification delivery failed (${deliveryStatus}): ${type} for user ${userId}: ${errMsg}`);
    }

    // Always persist the notification record to DynamoDB
    await this.dynamo.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        userId,
        createdAt: now,
        notificationId,
        type,
        channel,
        payload,
        deliveryStatus,
        sentAt: deliveryStatus === 'SENT' ? now : undefined,
      },
    }));

    return { notificationId, type, channel, deliveryStatus, sentAt: now };
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

    await this.sesCircuitBreaker.execute(
      () =>
        retryWithBackoff(
          () =>
            this.ses.send(new SendEmailCommand({
              Source: this.config.getOrThrow('SES_FROM_ADDRESS'),
              Destination: { ToAddresses: [to] },
              Message: {
                Subject: { Data: subject },
                Body: { Html: { Data: body } },
              },
            })),
          {
            maxRetries: 2,
            baseDelayMs: 1000,
            operationName: 'ses-send-email',
            isRetryable: (err) => {
              // Retry on throttling and transient errors, not on validation errors
              const name = (err as any)?.name ?? '';
              return ['ThrottlingException', 'ServiceUnavailable', 'InternalFailure'].includes(name);
            },
          },
        ),
    );
    this.logger.log(`Email sent: ${type} → ${to}`);
  }

  private async sendSms(phone: string, type: NotificationType, payload: Record<string, unknown>) {
    const message = this.buildSmsMessage(type, payload);

    await this.snsCircuitBreaker.execute(
      () =>
        retryWithBackoff(
          () =>
            this.sns.send(new PublishCommand({
              PhoneNumber: phone,
              Message: message,
            })),
          {
            maxRetries: 2,
            baseDelayMs: 1000,
            operationName: 'sns-send-sms',
          },
        ),
    );
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
    const subject = this.buildSubject(type);
    return `
      <html>
        <body style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✈ AeroLink</h1>
          </div>
          <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">${subject}</h2>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
              ${this.formatPayloadAsHtml(payload)}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
              This is an automated notification from AeroLink. Do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private formatPayloadAsHtml(payload: Record<string, unknown>): string {
    return Object.entries(payload)
      .filter(([key]) => !['email', 'phone'].includes(key)) // Don't leak PII back in email
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join('');
  }

  private buildSmsMessage(type: NotificationType, _payload: Record<string, unknown>): string {
    return `AeroLink: ${this.buildSubject(type)}`;
  }

  /** Expose circuit breaker metrics for the admin health endpoint */
  getCircuitBreakerMetrics() {
    return CircuitBreakerFactory.getAllMetrics();
  }
}
