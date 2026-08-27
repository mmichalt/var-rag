import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { loadBackendConfig, redisConnectionOptions } from '@var-rag/config';
import { DatabaseModule, PrismaService } from '@var-rag/database';
import Redis from 'ioredis';

const REDIS_CLIENT = Symbol('REDIS_CLIENT');
const config = loadBackendConfig();

@Injectable()
class WorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('worker');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
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
