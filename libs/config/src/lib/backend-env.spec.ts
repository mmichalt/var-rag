import { parseBackendEnv } from './backend-env.js';

const validEnv = {
  NODE_ENV: 'development',
  API_PORT: '3001',
  DATABASE_URL:
    'postgresql://football_rag:football_rag_dev@localhost:5432/football_rag',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
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
});
