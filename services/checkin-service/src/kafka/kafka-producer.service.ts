import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;

  constructor(@Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string }) {
    const kafka = new Kafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.producer = kafka.producer({ idempotent: true });
  }

  async onModuleInit() { await this.producer.connect(); }
  async onModuleDestroy() { await this.producer.disconnect(); }

  async emit(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  }
}
