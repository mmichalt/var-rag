import { loadBackendConfig } from '@var-rag/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './typeorm-options.js';

export const AppDataSource = new DataSource(
  createDataSourceOptions(loadBackendConfig()),
);

export default AppDataSource;
