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
        const url = config.getOrThrow<string>('REDIS_URL');
        // Enable TLS only for managed Redis (e.g. AWS ElastiCache in-transit
        // encryption), signalled by a `rediss://` URL or REDIS_TLS=true.
        // Local `redis://` stays plaintext — forcing TLS there times out.
        const useTls =
          url.startsWith('rediss://') ||
          config.get<string>('REDIS_TLS') === 'true';
        return new Redis(url, useTls ? { tls: {} } : {});
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
