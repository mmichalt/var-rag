import { parseBackendEnv } from './backend-env.js';

const validEnv = {
  NODE_ENV: 'development',
  API_PORT: '3001',
  DATABASE_URL:
    'postgresql://football_rag:football_rag_dev@localhost:5432/football_rag',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  OLLAMA_BASE_URL: 'http://localhost:11434',
  EMBEDDING_MODEL: 'nomic-embed-text',
  EMBEDDING_DIMENSIONS: '768',
  LLM_MODEL: 'llama3.2:3b',
  LLM_TEMPERATURE: '0',
  LLM_SEED: '1',
  LLM_NUM_CTX: '8192',
  SEMANTIC_CANDIDATE_K: '40',
  LEXICAL_CANDIDATE_K: '40',
  RETRIEVAL_TOP_K: '8',
  ASK_RATE_LIMIT_PER_MINUTE: '20',
  DIAGNOSTICS_ENABLED: 'false',
  QUERY_LOG_RETENTION_DAYS: '30',
};

describe('parseBackendEnv', () => {
  it('accepts a valid development configuration', () => {
    const config = parseBackendEnv(validEnv);
    expect(config.nodeEnv).toBe('development');
    expect(config.apiPort).toBe(3001);
    expect(config.databaseUrl).toContain('postgresql://');
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    expect(config.swaggerEnabled).toBe(true);
    expect(config.ollamaBaseUrl).toBe('http://localhost:11434');
    expect(config.embeddingDimensions).toBe(768);
    expect(config.retrievalTopK).toBe(8);
    expect(config.diagnosticsEnabled).toBe(false);
    expect(config.queryLogRetentionDays).toBe(30);
    expect(config.fakeModels).toBe(false);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() =>
      parseBackendEnv({ ...validEnv, DATABASE_URL: undefined }),
    ).toThrow(/DATABASE_URL/);
  });

  it('fails when REDIS_URL is malformed', () => {
    expect(() =>
      parseBackendEnv({ ...validEnv, REDIS_URL: 'not-a-redis-url' }),
    ).toThrow(/REDIS_URL/);
  });

  it('fails when EMBEDDING_DIMENSIONS is not 768', () => {
    expect(() =>
      parseBackendEnv({ ...validEnv, EMBEDDING_DIMENSIONS: '384' }),
    ).toThrow(/768/);
  });

  it('fails when OLLAMA_BASE_URL is missing', () => {
    expect(() =>
      parseBackendEnv({ ...validEnv, OLLAMA_BASE_URL: undefined }),
    ).toThrow(/OLLAMA_BASE_URL/);
  });
});
