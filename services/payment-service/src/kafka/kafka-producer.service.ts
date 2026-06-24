import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Partitioners } from 'kafkajs';
import { createKafka, ensureTopics } from '@aerolink/common-middleware';
import { TOPICS } from '@aerolink/events';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: ReturnType<typeof createKafka>;
  private producer: Producer;

  constructor(@Inject('KAFKA_CONFIG') private readonly config: { brokers: string[]; clientId: string }) {
    this.kafka = createKafka({ clientId: this.config.clientId, brokers: this.config.brokers });
    this.producer = this.kafka.producer({
      // NOT idempotent: the idempotent producer needs an InitProducerId
      // handshake with the transaction coordinator, which STALLS while the
      // MSK group is rebalancing -> the awaited send() hangs -> the HTTP
      // request blocks until the API Gateway 29s timeout -> 504 -> "Network Error".
      createPartitioner: Partitioners.LegacyPartitioner, // keep key-based partitioning (+ silences v2 warning)
      retry: { retries: 5, initialRetryTime: 300 },
    });
  }

  async onModuleInit() {
    // Non-fatal: if MSK is briefly unreachable at boot, DO NOT crash the app
    // (a thrown onModuleInit aborts Nest bootstrap -> CrashLoopBackOff -> 503).
    // kafkajs auto-connects on the first send(), so the service stays up.
    try {
      await this.producer.connect();
      await ensureTopics(this.kafka, Object.values(TOPICS));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[kafka] producer init deferred (will connect on first send):', (err as Error)?.message);
    }
  }
  async onModuleDestroy() { await this.producer.disconnect(); }

  async emit(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({
      topic,
      acks: 1,        // leader ack only — returns in ms, doesn't wait on a flapping quorum
      timeout: 5000,  // fail fast (5s) instead of hanging to the gateway timeout
      messages: [{ key, value: JSON.stringify(value) }],
    });
  }
}
