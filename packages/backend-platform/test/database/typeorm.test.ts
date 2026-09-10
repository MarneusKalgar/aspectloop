import type { DataSourceOptions } from 'typeorm';

import { join } from 'node:path';
import { expect, test } from 'vitest';

import { createPostgresDataSourceOptions, getTypeOrmDiscoveryPaths } from '../../src/database';

const DATABASE_URL = 'postgresql://service_app:service_app@postgres:5432/service_db';
const SERVICE_ROOT = '/workspace/apps/service';

/** Creates shared datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv = 'development', poolSize?: number): DataSourceOptions {
  const paths = getTypeOrmDiscoveryPaths('source', SERVICE_ROOT);

  return createPostgresDataSourceOptions({
    databaseUrl: DATABASE_URL,
    entities: paths.entities,
    migrations: paths.migrations,
    nodeEnv,
    poolSize,
  });
}

/** Verifies connection and query limits use the bounded platform defaults. */
function testDatasourceCapacityContract(): void {
  const options = createOptions();

  expect(options.extra).toMatchObject({
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
  expect(options.maxQueryExecutionTime).toBe(1000);
  expect(createOptions('development', 6).extra).toMatchObject({ max: 6 });
  expect(options.logging).toEqual(['error', 'warn']);
  expect(createOptions('production').logging).toEqual(['error']);
}

/** Verifies schema mutation and broad invalid filters remain disabled centrally. */
function testDatasourceSafetyContract(): void {
  const options = createOptions();

  expect(options.invalidWhereValuesBehavior).toEqual({
    null: 'throw',
    undefined: 'throw',
  });
  expect(options.migrationsRun).toBe(false);
  expect(options.synchronize).toBe(false);
}

/** Verifies source and compiled processes select explicit non-empty discovery paths. */
function testDiscoveryContract(): void {
  expect(getTypeOrmDiscoveryPaths('source', SERVICE_ROOT)).toEqual({
    entities: [join(SERVICE_ROOT, 'src/**/*.entity{.ts,.js}')],
    migrations: [join(SERVICE_ROOT, 'src/db/migrations/*{.ts,.js}')],
  });
  expect(getTypeOrmDiscoveryPaths('compiled', SERVICE_ROOT)).toEqual({
    entities: [join(SERVICE_ROOT, 'dist/**/*.entity.js')],
    migrations: [join(SERVICE_ROOT, 'dist/db/migrations/*.js')],
  });
}

test(
  'shared datasources keep schema changes and invalid filters explicit',
  testDatasourceSafetyContract,
);
test(
  'shared datasources use bounded connection and query defaults',
  testDatasourceCapacityContract,
);
test('shared datasources select exact source and compiled discovery paths', testDiscoveryContract);
