import type { DataSourceOptions } from 'typeorm';

import { expect, test } from 'vitest';

import { getTypeOrmDataSourceOptions } from '../../src/config/typeorm';

const DATABASE_URL = 'postgresql://aspectloop:aspectloop@postgres:5432/aspectloop';

/** Creates datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv: string): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    nodeEnv,
  });
}

/** Verifies application startup cannot mutate the database schema implicitly. */
function testDatabaseChangesRemainExplicit(): void {
  const options = createOptions('development');

  expect(options.migrationsRun).toBe(false);
  expect(options.synchronize).toBe(false);
}

/** Verifies high-level repository filters cannot silently broaden a query. */
function testInvalidWhereValuesFailClosed(): void {
  const options = createOptions('development');

  expect(options.invalidWhereValuesBehavior).toEqual({
    null: 'throw',
    undefined: 'throw',
  });
}

/** Verifies source and compiled runtimes discover migrations from their own layouts. */
function testMigrationDiscoveryPaths(): void {
  const expectations: [string, string[]][] = [
    ['development', ['src/db/migrations/*{.ts,.js}']],
    ['production', ['dist/db/migrations/*.js']],
    ['stage', ['dist/db/migrations/*.js']],
  ];

  for (const [nodeEnv, expectedMigrations] of expectations) {
    expect(createOptions(nodeEnv).migrations).toEqual(expectedMigrations);
  }
}

test('rejects null and undefined high-level where values', testInvalidWhereValuesFailClosed);
test('keeps schema changes and startup migrations explicit', testDatabaseChangesRemainExplicit);
test('uses the expected source and compiled migration paths', testMigrationDiscoveryPaths);
