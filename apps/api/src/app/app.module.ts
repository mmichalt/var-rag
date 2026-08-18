import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { loadBackendConfig, redisConnectionOptions } from '@var-rag/config';
import { DatabaseModule } from '@var-rag/database';
import Redis from 'ioredis';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from './tokens';

const config = loadBackendConfig();

@Injectable()
class RedisShutdown implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: redisConnectionOptions(config.redisUrl),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    RedisShutdown,
  ],
  controllers: [HealthController],
  exports: [REDIS_CLIENT],
})
export class AppModule {}
