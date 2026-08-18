import type { BackendConfig } from '@var-rag/config';
import type { DataSourceOptions } from 'typeorm';
import { EnablePgvector0001 } from './migrations/0001-EnablePgvector.js';

// TypeORM loads the PostgreSQL driver by package name at runtime.
import 'pg';

export const migrations = [EnablePgvector0001];

export function createDataSourceOptions(
  config: BackendConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: config.databaseUrl,
    synchronize: false,
    migrationsRun: false,
    entities: [],
    migrations,
    logging:
      config.logLevel === 'debug' ? ['error', 'warn', 'schema'] : ['error'],
  };
}
