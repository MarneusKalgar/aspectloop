import type { DataSourceOptions } from 'typeorm';

import { expect, test } from 'vitest';

import { getTypeOrmDataSourceOptions } from '../../src/config/typeorm';

const DATABASE_URL = 'postgresql://platform_app:platform_app@postgres:5432/platform_db';

/** Creates datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv: string): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    nodeEnv,
  });
}

/** Verifies the gateway adapter retains its explicit platform entity inventory. */
function testEntityInventory(): void {
  const options = createOptions('development');

  expect(options.entities).toHaveLength(4);
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

test('retains the gateway platform entity inventory', testEntityInventory);
test('uses the expected source and compiled migration paths', testMigrationDiscoveryPaths);
