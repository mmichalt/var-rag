import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { BackendConfig } from '@var-rag/config';
import { PrismaService } from '@var-rag/database';
import request from 'supertest';
import { configureHttpApp } from '../http';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from './tokens';

const testConfig: BackendConfig = {
  nodeEnv: 'test',
  apiPort: 3001,
  databaseUrl:
    'postgresql://football_rag:football_rag_dev@localhost:5432/football_rag',
  redisUrl: 'redis://localhost:6379',
  corsOrigins: ['http://localhost:3000'],
  logLevel: 'error',
  swaggerEnabled: false,
  ollamaBaseUrl: 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
  embeddingDimensions: 768,
  llmModel: 'llama3.2:3b',
  llmTemperature: 0,
  llmSeed: 1,
  llmNumCtx: 8192,
  semanticCandidateK: 40,
  lexicalCandidateK: 40,
  retrievalTopK: 8,
  askRateLimitPerMinute: 20,
  diagnosticsEnabled: false,
  queryLogRetentionDays: 30,
  fakeModels: false,
};

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { ping: jest.fn().mockResolvedValue('PONG') },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureHttpApp(app, testConfig);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns success for liveness', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/health/live',
    );
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('preserves an incoming request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'req-test-12345');
    expect(response.headers['x-request-id']).toBe('req-test-12345');
  });

  it('creates a request id when none is sent', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/health/live',
    );
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-request-id'].length).toBeGreaterThanOrEqual(8);
  });
});
