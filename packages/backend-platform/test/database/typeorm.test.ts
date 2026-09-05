import type { DataSourceOptions } from 'typeorm';

import { expect, test } from 'vitest';

import { createPostgresDataSourceOptions, getTypeOrmDiscoveryPaths } from '../../src/database';

const DATABASE_URL = 'postgresql://service_app:service_app@postgres:5432/service_db';

/** Creates shared datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv = 'development', poolSize?: number): DataSourceOptions {
  const paths = getTypeOrmDiscoveryPaths(nodeEnv);

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

/** Verifies every supported runtime selects explicit non-empty discovery paths. */
function testDiscoveryContract(): void {
  expect(getTypeOrmDiscoveryPaths('development')).toEqual({
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/db/migrations/*{.ts,.js}'],
  });
  expect(getTypeOrmDiscoveryPaths('production')).toEqual({
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/db/migrations/*.js'],
  });
  expect(getTypeOrmDiscoveryPaths('stage')).toEqual({
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/db/migrations/*.js'],
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
