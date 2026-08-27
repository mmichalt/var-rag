import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { loadBackendConfig, redisConnectionOptions } from '@var-rag/config';
import { DatabaseModule, PrismaService } from '@var-rag/database';
import Redis from 'ioredis';
import { CORPUS_QUEUE, CorpusProcessor } from './corpus.processor';

const REDIS_CLIENT = Symbol('REDIS_CLIENT');
const config = loadBackendConfig();

@Injectable()
class WorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('worker');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(CORPUS_QUEUE)
    private readonly corpus: {
      upsertJobScheduler: (
        id: string,
        repeat: { every: number },
        template: { name: string; data: object },
      ) => Promise<unknown>;
    },
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.ping();
    await this.corpus.upsertJobScheduler(
      'prune-answer-logs',
      { every: 24 * 60 * 60 * 1000 },
      { name: 'prune-answer-logs', data: {} },
    );
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
    BullModule.registerQueue({ name: CORPUS_QUEUE }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    CorpusProcessor,
    WorkerRuntime,
  ],
})
export class WorkerModule {}
