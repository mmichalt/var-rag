import type { BackendConfig } from '@var-rag/config';
import { createDataSourceOptions } from './typeorm-options.js';

const config: BackendConfig = {
  nodeEnv: 'test',
  apiPort: 3001,
  databaseUrl:
    'postgresql://football_rag:football_rag_dev@localhost:5432/football_rag',
  redisUrl: 'redis://localhost:6379',
  corsOrigins: ['http://localhost:3000'],
  logLevel: 'info',
  swaggerEnabled: false,
};

describe('createDataSourceOptions', () => {
  it('keeps synchronize disabled', () => {
    const options = createDataSourceOptions(config);
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });
});
