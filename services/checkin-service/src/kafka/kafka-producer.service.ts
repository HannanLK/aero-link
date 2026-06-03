import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { createKafka, ensureTopics } from '@aerolink/common-middleware';
import { TOPICS } from '@aerolink/events';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: ReturnType<typeof createKafka>;
  private producer: Producer;

  constructor(@Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string }) {
    this.kafka = createKafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.producer = this.kafka.producer({ idempotent: true });
  }

  async onModuleInit() {
    await this.producer.connect();
    await ensureTopics(this.kafka, Object.values(TOPICS));
  }
  async onModuleDestroy() { await this.producer.disconnect(); }

  async emit(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  }
}
