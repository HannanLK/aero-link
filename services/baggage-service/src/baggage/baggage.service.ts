import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { TOPICS, buildBaggageStatusUpdatedEvent } from '@aerolink/events';
import { v4 as uuidv4 } from 'uuid';

export type BaggageStatus = 'TAGGED' | 'CHECKED_IN' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'COLLECTED' | 'LOST';

const VALID_TRANSITIONS: Record<BaggageStatus, BaggageStatus[]> = {
  TAGGED:     ['CHECKED_IN'],
  CHECKED_IN: ['LOADED'],
  LOADED:     ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED'],
  ARRIVED:    ['COLLECTED', 'LOST'],
  COLLECTED:  [],
  LOST:       [],
};

@Injectable()
export class BaggageService {
  private readonly logger = new Logger(BaggageService.name);
  // typed `any` to sidestep @aws-sdk/lib-dynamodb vs @smithy/types version skew (runtime is unaffected)
  private readonly dynamo: any;
  private readonly tableName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly kafka: KafkaProducerService,
  ) {
    const endpoint = config.get<string>('DYNAMODB_ENDPOINT');
    const client = new DynamoDBClient({
      region: config.getOrThrow('AWS_REGION'),
      ...(endpoint ? { endpoint } : {}),
    });
    this.dynamo = DynamoDBDocumentClient.from(client);
    this.tableName = config.get<string>('DYNAMODB_BAGGAGE_TABLE') ?? config.getOrThrow('BAGGAGE_TABLE_NAME');
  }

  async scan(barcode: string) {
    return this.getByBarcode(barcode);
  }

  async updateStatus(barcode: string, newStatus: BaggageStatus, scannedBy: string, correlationId: string) {
    const bagItem = await this.getByBarcode(barcode);

    const allowed = VALID_TRANSITIONS[bagItem.status as BaggageStatus];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException({
        message: `Cannot transition from ${bagItem.status} to ${newStatus}`,
        allowedTransitions: allowed,
      });
    }

    const previousStatus = bagItem.status;
    await this.dynamo.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { bagId: bagItem.bagId },
      UpdateExpression: 'SET #s = :newStatus, updatedAt = :now, scannedBy = :scannedBy',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':newStatus': newStatus,
        ':now': new Date().toISOString(),
        ':scannedBy': scannedBy,
      },
    }));

    await this.kafka.emit(TOPICS.BAGGAGE_STATUS_UPDATED, bagItem.bagId, buildBaggageStatusUpdatedEvent({
      bagId: bagItem.bagId,
      barcode,
      bookingId: bagItem.bookingId,
      flightId: bagItem.flightId,
      previousStatus,
      newStatus,
      scannedBy,
      correlationId,
    }));

    return { ...bagItem, status: newStatus };
  }

  async getByBooking(bookingId: string) {
    const result = await this.dynamo.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'booking-index',
      KeyConditionExpression: 'bookingId = :bookingId',
      ExpressionAttributeValues: { ':bookingId': bookingId },
    }));
    return result.Items ?? [];
  }

  async getByFlight(flightId: string) {
    const result = await this.dynamo.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'flight-index',
      KeyConditionExpression: 'flightId = :flightId',
      ExpressionAttributeValues: { ':flightId': flightId },
    }));
    return result.Items ?? [];
  }

  async createTag(bookingId: string, flightId: string, barcode: string, passengerId: string) {
    const bagId = uuidv4();
    const item = {
      bagId,
      barcode,
      bookingId,
      flightId,
      passengerId,
      status: 'TAGGED' as BaggageStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.dynamo.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(bagId)',
    }));
    return item;
  }

  private async getByBarcode(barcode: string) {
    const result = await this.dynamo.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'barcode-index',
      KeyConditionExpression: 'barcode = :barcode',
      ExpressionAttributeValues: { ':barcode': barcode },
      Limit: 1,
    }));
    if (!result.Items?.length) throw new NotFoundException(`Bag with barcode ${barcode} not found`);
    return result.Items[0] as { bagId: string; barcode: string; bookingId: string; flightId: string; status: BaggageStatus };
  }
}
