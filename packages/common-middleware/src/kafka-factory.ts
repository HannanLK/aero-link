import { Kafka, KafkaConfig, ITopicConfig } from 'kafkajs';

export interface CreateKafkaOptions {
  clientId: string;
  brokers: string[];
}

/**
 * Build a KafkaJS client that works in both environments:
 *
 *  - AWS MSK  (KAFKA_AUTH=iam): TLS + SASL/IAM. An OAUTHBEARER token is minted
 *    per connection by aws-msk-iam-sasl-signer-js using the pod's IRSA role.
 *  - Local docker-compose (default): plain PLAINTEXT to the local broker.
 *
 * The signer is lazy-required so it's only needed in the cloud runtime.
 */
export function createKafka(opts: CreateKafkaOptions): Kafka {
  const base: KafkaConfig = { clientId: opts.clientId, brokers: opts.brokers };

  if (process.env.KAFKA_AUTH === 'iam') {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js');

    const sasl = {
      mechanism: 'oauthbearer',
      oauthBearerProvider: async () => {
        const { token } = await generateAuthToken({ region });
        return { value: token };
      },
    };

    const iamConfig: KafkaConfig = { ...base, ssl: true, sasl: sasl as any };
    return new Kafka(iamConfig);
  }

  return new Kafka(base);
}

/**
 * Idempotently create Kafka topics. MSK has auto.create.topics.enable=false,
 * so topics must be created explicitly. Safe to call from every service on
 * startup: existing topics are skipped and failures are swallowed so a missing
 * admin permission never crash-loops the pod.
 */
export async function ensureTopics(
  kafka: Kafka,
  topics: string[],
  opts: { numPartitions?: number; replicationFactor?: number } = {},
): Promise<void> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = new Set(await admin.listTopics());
    const defaultReplication = process.env.KAFKA_AUTH === 'iam' ? 2 : 1;
    const toCreate: ITopicConfig[] = topics
      .filter((t) => !existing.has(t))
      .map((topic) => ({
        topic,
        numPartitions: opts.numPartitions ?? 3,
        replicationFactor: opts.replicationFactor ?? defaultReplication,
      }));
    if (toCreate.length > 0) {
      await admin.createTopics({ topics: toCreate, waitForLeaders: true });
      // eslint-disable-next-line no-console
      console.log('[kafka] created topics: ' + toCreate.map((t) => t.topic).join(', '));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[kafka] ensureTopics skipped: ' + (err as Error).message);
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}
