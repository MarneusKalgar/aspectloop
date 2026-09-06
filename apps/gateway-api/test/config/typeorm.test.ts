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

/** Verifies source and compiled runtimes discover entities and migrations from their own layouts. */
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
  }
}

test('uses the expected source and compiled discovery paths', testDiscoveryPaths);
