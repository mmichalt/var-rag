import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { loadBackendConfig, redisConnectionOptions } from '@var-rag/config';
import { DatabaseModule } from '@var-rag/database';
import Redis from 'ioredis';
import type { DataSource } from 'typeorm';

const REDIS_CLIENT = Symbol('REDIS_CLIENT');
const config = loadBackendConfig();

@Injectable()
class WorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('worker');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query('SELECT 1');
    await this.redis.ping();
    this.logger.log({
      msg: 'Worker started',
      postgres: 'connected',
      redis: 'connected',
      bullmq: 'configured',
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log({ msg: 'Worker shutting down' });
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
    WorkerRuntime,
  ],
})
export class WorkerModule {}
