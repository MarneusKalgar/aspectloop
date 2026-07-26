import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { getTypeOrmDataSourceOptions } from './config/typeorm';
import { loadEnvFiles } from './core/environment';

loadEnvFiles();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const appDataSource = new DataSource(
  getTypeOrmDataSourceOptions({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    poolSize: process.env.DB_POOL_SIZE ? Number(process.env.DB_POOL_SIZE) : undefined,
    slowQueryThresholdMs: process.env.DB_SLOW_QUERY_THRESHOLD_MS
      ? Number(process.env.DB_SLOW_QUERY_THRESHOLD_MS)
      : undefined,
  }),
);

export default appDataSource;
