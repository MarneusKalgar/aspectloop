import type { DataSourceOptions } from 'typeorm';

import { expect, test } from 'vitest';

import { validateEnv } from '../../src/config/env.validation';
import { getTypeOrmDataSourceOptions } from '../../src/config/typeorm';

const DATABASE_URL = 'postgresql://extraction_app:extraction_app@postgres:5432/extraction_db';

/** Creates extraction datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv: string): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    nodeEnv,
  });
}

/** Verifies environment validation rejects an empty owned-database URL. */
function testDatabaseUrlValidation(): void {
  expect(() => validateEnv({ DATABASE_URL: '' })).toThrow('Environment validation failed');
}

/** Verifies source and compiled runtimes retain explicit non-empty discovery globs. */
function testDiscoveryPaths(): void {
  const expectations: [string, string[], string[]][] = [
    ['development', ['src/**/*.entity{.ts,.js}'], ['src/db/migrations/*{.ts,.js}']],
    ['production', ['dist/**/*.entity.js'], ['dist/db/migrations/*.js']],
    ['stage', ['dist/**/*.entity.js'], ['dist/db/migrations/*.js']],
  ];

  for (const [nodeEnv, expectedEntities, expectedMigrations] of expectations) {
    const options = createOptions(nodeEnv);

    expect(options.entities).toEqual(expectedEntities);
    expect(options.migrations).toEqual(expectedMigrations);
    expect(expectedEntities).not.toHaveLength(0);
    expect(expectedMigrations).not.toHaveLength(0);
  }
}

/** Verifies TypeORM CLI string values become validated numeric settings. */
function testNumericEnvironmentCoercion(): void {
  const environment = validateEnv({
    DATABASE_URL,
    DB_POOL_SIZE: '6',
    DB_SLOW_QUERY_THRESHOLD_MS: '250',
    EXTRACTION_SERVICE_PORT: '8081',
  });

  expect(environment.DB_POOL_SIZE).toBe(6);
  expect(environment.DB_SLOW_QUERY_THRESHOLD_MS).toBe(250);
  expect(environment.EXTRACTION_SERVICE_PORT).toBe(8081);
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
test('rejects an empty extraction database URL', testDatabaseUrlValidation);
test('rejects a pool above the extraction allocation', testPoolBudgetValidation);
test('coerces extraction CLI numeric environment values', testNumericEnvironmentCoercion);
