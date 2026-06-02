/**
 * Distributed tracing bootstrap (OpenTelemetry → OTLP → AWS X-Ray).
 *
 * Call `initTracing('service-name')` as the VERY FIRST thing in main.ts,
 * before any other imports are evaluated, so auto-instrumentation can patch
 * http / fastify / kafkajs / pg / aws-sdk before they are loaded.
 *
 * Spans are exported over OTLP/HTTP to the in-cluster OpenTelemetry Collector
 * (see infrastructure/terraform/modules/eks-addons), which forwards them to
 * AWS X-Ray. Trace IDs use the X-Ray-compatible id generator + propagator so
 * traces correlate end-to-end across services.
 *
 * Controlled by env vars:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  (default http://otel-collector:4318)
 *   OTEL_TRACES_ENABLED          ('false' disables tracing entirely)
 *   OTEL_SERVICE_NAMESPACE       (default 'aerolink')
 *
 * Implemented with lazy require() + try/catch so the package compiles and
 * runs even before the @opentelemetry/* packages are installed (in which case
 * tracing simply no-ops with a warning).
 */
export function initTracing(serviceName: string): void {
  if (process.env.OTEL_TRACES_ENABLED === 'false') {
    return;
  }

  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const {
      SemanticResourceAttributes,
    } = require('@opentelemetry/semantic-conventions');
    const { AWSXRayIdGenerator } = require('@opentelemetry/id-generator-aws-xray');
    const { AWSXRayPropagator } = require('@opentelemetry/propagator-aws-xray');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]:
          process.env.OTEL_SERVICE_NAMESPACE ?? 'aerolink',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          process.env.NODE_ENV ?? 'development',
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      idGenerator: new AWSXRayIdGenerator(),
      textMapPropagator: new AWSXRayPropagator(),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs instrumentation is noisy and low-value
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[tracing] OpenTelemetry started for ${serviceName} → ${endpoint}`);

    const shutdown = () =>
      sdk
        .shutdown()
        .catch((err: unknown) => console.error('[tracing] shutdown error', err))
        .finally(() => process.exit(0));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    // OTel not installed or failed to start — degrade gracefully.
    // eslint-disable-next-line no-console
    console.warn(
      `[tracing] disabled for ${serviceName}: ${(err as Error).message}`,
    );
  }
}
