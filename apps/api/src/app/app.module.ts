import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { loadBackendConfig, redisConnectionOptions } from '@var-rag/config';
import { DatabaseModule } from '@var-rag/database';
import {
  FakeAnswerGenerator,
  HashEmbedder,
  OllamaAnswerGenerator,
  OllamaEmbedder,
  resolveModelDigest,
} from '@var-rag/rag';
import Redis from 'ioredis';
import { AskController } from './ask/ask.controller';
import { AskService } from './ask/ask.service';
import { LawEditionsController } from './editions/editions.controller';
import { EvidenceController } from './evidence/evidence.controller';
import { HealthController } from './health.controller';
import { ANSWER_GENERATOR, EMBEDDER, REDIS_CLIENT } from './tokens';

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
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: config.askRateLimitPerMinute,
        },
      ],
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    RedisShutdown,
    {
      provide: EMBEDDER,
      useFactory: async () => {
        if (config.fakeModels) {
          return new HashEmbedder(
            config.embeddingModel,
            config.embeddingDimensions,
          );
        }
        const embedder = new OllamaEmbedder(
          config.ollamaBaseUrl,
          config.embeddingModel,
          config.embeddingDimensions,
        );
        try {
          embedder.digest = await resolveModelDigest(
            config.ollamaBaseUrl,
            config.embeddingModel,
          );
        } catch {
          embedder.digest = '';
        }
        return embedder;
      },
    },
    {
      provide: ANSWER_GENERATOR,
      useFactory: async () => {
        if (config.fakeModels) {
          return new FakeAnswerGenerator(config.llmModel);
        }
        const generator = new OllamaAnswerGenerator(
          config.ollamaBaseUrl,
          config.llmModel,
          {
            temperature: config.llmTemperature,
            seed: config.llmSeed,
            numCtx: config.llmNumCtx,
          },
        );
        try {
          generator.digest = await resolveModelDigest(
            config.ollamaBaseUrl,
            config.llmModel,
          );
        } catch {
          generator.digest = '';
        }
        return generator;
      },
    },
    AskService,
  ],
  controllers: [
    HealthController,
    AskController,
    EvidenceController,
    LawEditionsController,
  ],
  exports: [REDIS_CLIENT],
})
export class AppModule {}
