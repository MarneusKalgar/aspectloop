import 'reflect-metadata';
import { loadEnvFiles } from '@aspectloop/backend-platform/config';
import { DataSource } from 'typeorm';

import { validateEnv } from './config/env.validation';
import { getTypeOrmDataSourceOptions } from './config/typeorm';

loadEnvFiles();

const environment = validateEnv(process.env);
const appDataSource = new DataSource(
  getTypeOrmDataSourceOptions({
    databaseUrl: environment.DATABASE_URL,
    nodeEnv: environment.NODE_ENV,
    poolSize: environment.DB_POOL_SIZE,
    slowQueryThresholdMs: environment.DB_SLOW_QUERY_THRESHOLD_MS,
  }),
);

export default appDataSource;
