import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        // Enable TLS only for managed Redis (e.g. AWS ElastiCache in-transit
        // encryption), signalled by a `rediss://` URL or REDIS_TLS=true.
        const useTls =
          url.startsWith('rediss://') ||
          config.get<string>('REDIS_TLS') === 'true';
        const client = new Redis(url, {
          ...(useTls ? { tls: {} } : {}),
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        // CRITICAL: an ioredis 'error' with no listener is an unhandled
        // EventEmitter error -> Node kills the process -> CrashLoopBackOff ->
        // ALB has no healthy target -> 503 on /flights/search. Swallow it; the
        // search path already falls back to the DB when Redis is unavailable.
        client.on('error', (err: Error) =>
          // eslint-disable-next-line no-console
          console.warn('[redis] non-fatal connection error (falling back to DB):', err?.message),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
