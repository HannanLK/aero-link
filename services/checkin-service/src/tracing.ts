// Side-effect import — MUST be the first import in main.ts so OpenTelemetry
// auto-instrumentation can patch http/fastify/kafkajs/pg/aws-sdk before they load.
import { initTracing } from '@aerolink/common-middleware';

initTracing('checkin-service');
