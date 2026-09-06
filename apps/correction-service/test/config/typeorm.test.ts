import type { DataSourceOptions } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { expect, test } from 'vitest';

import { validateEnv } from '../../src/config/env.validation';
import { getTypeOrmDataSourceOptions, getTypeOrmModuleOptions } from '../../src/config/typeorm';

const DATABASE_URL = 'postgresql://correction_app:correction_app@postgres:5432/correction_db';

/** Creates correction datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv: string, discoveryMode: 'compiled' | 'source'): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    discoveryMode,
    nodeEnv,
  });
}

/** Verifies environment validation rejects an empty owned-database URL. */
function testDatabaseUrlValidation(): void {
  expect(() => validateEnv({ DATABASE_URL: '' })).toThrow('Environment validation failed');
}

/** Verifies discovery follows the process execution form rather than NODE_ENV. */
function testDiscoveryPaths(): void {
  const expectations: [string, 'compiled' | 'source', string[], string[]][] = [
    ['development', 'source', ['src/**/*.entity{.ts,.js}'], ['src/db/migrations/*{.ts,.js}']],
    ['development', 'compiled', ['dist/**/*.entity.js'], ['dist/db/migrations/*.js']],
    ['production', 'compiled', ['dist/**/*.entity.js'], ['dist/db/migrations/*.js']],
  ];

  for (const [nodeEnv, discoveryMode, expectedEntities, expectedMigrations] of expectations) {
    const options = createOptions(nodeEnv, discoveryMode);

    expect(options.entities).toEqual(expectedEntities);
    expect(options.migrations).toEqual(expectedMigrations);
    expect(expectedEntities).not.toHaveLength(0);
    expect(expectedMigrations).not.toHaveLength(0);
  }
}

/** Verifies the compiled Nest watcher never asks Node to load source files. */
function testNestDiscoveryPaths(): void {
  const options = getTypeOrmModuleOptions(
    new ConfigService({
      DATABASE_URL,
      NODE_ENV: 'development',
    }),
  );

  expect(options.entities).toEqual(['dist/**/*.entity.js']);
  expect(options.migrations).toEqual(['dist/db/migrations/*.js']);
  expect(options.autoLoadEntities).toBe(true);
}

/** Verifies TypeORM CLI string values become validated numeric settings. */
function testNumericEnvironmentCoercion(): void {
  const environment = validateEnv({
    CORRECTION_SERVICE_PORT: '8082',
    DATABASE_URL,
    DB_POOL_SIZE: '6',
    DB_SLOW_QUERY_THRESHOLD_MS: '250',
  });

  expect(environment.CORRECTION_SERVICE_PORT).toBe(8082);
  expect(environment.DB_POOL_SIZE).toBe(6);
  expect(environment.DB_SLOW_QUERY_THRESHOLD_MS).toBe(250);
}

/** Verifies environment validation rejects a pool above the M04-C allocation. */
function testPoolBudgetValidation(): void {
  expect(() =>
    validateEnv({
      DATABASE_URL,
      DB_POOL_SIZE: '11',
    }),
  ).toThrow('Environment validation failed');
}

test('uses explicit source and compiled datasource discovery paths', testDiscoveryPaths);
test('uses compiled discovery paths in the Nest development runtime', testNestDiscoveryPaths);
test('rejects an empty correction database URL', testDatabaseUrlValidation);
test('rejects a pool above the correction allocation', testPoolBudgetValidation);
test('coerces correction CLI numeric environment values', testNumericEnvironmentCoercion);
