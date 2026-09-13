import type { DataSourceOptions } from 'typeorm';

import { getTypeOrmDataSourceOptions, getTypeOrmModuleOptions } from '@gateway/config/typeorm';
import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const DATABASE_URL =
  'postgresql://gateway_correction_runtime:gateway_correction_runtime@postgres:5432/platform_db';
const APPLICATION_ROOT = resolve(__dirname, '../..');

/** Creates datasource options without connecting to PostgreSQL. */
function createOptions(nodeEnv: string, discoveryMode: 'compiled' | 'source'): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    discoveryMode,
    nodeEnv,
  });
}

/** Verifies discovery follows the process execution form rather than NODE_ENV. */
function testDiscoveryPaths(): void {
  const expectations: [string, 'compiled' | 'source', string[], string[]][] = [
    ['development', 'source', [join(APPLICATION_ROOT, 'src/**/*.entity{.ts,.js}')], []],
    ['development', 'compiled', [join(APPLICATION_ROOT, 'dist/**/*.entity.js')], []],
    ['production', 'compiled', [join(APPLICATION_ROOT, 'dist/**/*.entity.js')], []],
  ];

  for (const [nodeEnv, discoveryMode, expectedEntities, expectedMigrations] of expectations) {
    const options = createOptions(nodeEnv, discoveryMode);

    expect(options.entities).toEqual(expectedEntities);
    expect(options.migrations).toEqual(expectedMigrations);
  }
}

/** Verifies the compiled Nest watcher never asks Node to load decorated source files. */
function testNestDiscoveryPaths(): void {
  const options = getTypeOrmModuleOptions(
    new ConfigService({
      DATABASE_URL,
      NODE_ENV: 'development',
    }),
  );

  expect(options.entities).toEqual([join(APPLICATION_ROOT, 'dist/**/*.entity.js')]);
  expect(options.migrations).toEqual([]);
  expect(options.autoLoadEntities).toBe(true);
}

test('uses the expected source and compiled discovery paths', testDiscoveryPaths);
test('uses compiled discovery paths in the Nest development runtime', testNestDiscoveryPaths);
