import type { DataSourceOptions } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { validateEnv } from '../../src/config/env.validation';
import { getTypeOrmDataSourceOptions, getTypeOrmModuleOptions } from '../../src/config/typeorm';

const APPLICATION_ROOT = resolve(__dirname, '../..');
const DATABASE_URL = 'postgresql://platform_app:platform_app@postgres:5432/platform_db';
const VALID_ENVIRONMENT = {
  DATABASE_URL,
  JWT_ACCESS_SECRET: 'test-only-secret',
  PLATFORM_S3_ACCESS_KEY_ID: 'test-access-key',
  PLATFORM_S3_BUCKET: 'aspectloop-platform-source',
  PLATFORM_S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_ENDPOINT: 'http://garage:3900',
  S3_FORCE_PATH_STYLE: 'true',
  S3_REGION: 'garage',
};

/** Creates Platform datasource options without connecting to PostgreSQL. */
function createOptions(discoveryMode: 'compiled' | 'source'): DataSourceOptions {
  return getTypeOrmDataSourceOptions({
    databaseUrl: DATABASE_URL,
    discoveryMode,
    nodeEnv: 'development',
  });
}

/** Verifies Platform discovery is anchored to the owning service directory. */
function testDiscoveryPaths(): void {
  const sourceOptions = createOptions('source');
  const compiledOptions = createOptions('compiled');

  expect(sourceOptions.entities).toEqual([join(APPLICATION_ROOT, 'src/**/*.entity{.ts,.js}')]);
  expect(sourceOptions.migrations).toEqual([
    join(APPLICATION_ROOT, 'src/db/migrations/*{.ts,.js}'),
  ]);
  expect(compiledOptions.entities).toEqual([join(APPLICATION_ROOT, 'dist/**/*.entity.js')]);
  expect(compiledOptions.migrations).toEqual([join(APPLICATION_ROOT, 'dist/db/migrations/*.js')]);
}

/** Verifies Platform configuration rejects missing ownership and excess capacity. */
function testInvalidEnvironment(): void {
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, DATABASE_URL: '' })).toThrow(
    'Environment validation failed',
  );
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, DB_POOL_SIZE: '6' })).toThrow(
    'Environment validation failed',
  );
}

/** Verifies the Nest runtime uses compiled discovery plus auto-loaded entities. */
function testNestDiscoveryPaths(): void {
  const options = getTypeOrmModuleOptions(
    new ConfigService({
      DATABASE_URL,
      NODE_ENV: 'development',
    }),
  );

  expect(options.entities).toEqual([join(APPLICATION_ROOT, 'dist/**/*.entity.js')]);
  expect(options.migrations).toEqual([join(APPLICATION_ROOT, 'dist/db/migrations/*.js')]);
  expect(options.autoLoadEntities).toBe(true);
}

/** Verifies Platform CLI values are transformed into bounded numeric settings. */
function testNumericEnvironmentCoercion(): void {
  const environment = validateEnv({
    ...VALID_ENVIRONMENT,
    DB_POOL_SIZE: '5',
    DB_SLOW_QUERY_THRESHOLD_MS: '250',
    PLATFORM_SERVICE_PORT: '8083',
  });

  expect(environment.DB_POOL_SIZE).toBe(5);
  expect(environment.DB_SLOW_QUERY_THRESHOLD_MS).toBe(250);
  expect(environment.PLATFORM_SERVICE_PORT).toBe(8083);
}

test('uses Platform-owned datasource discovery paths', testDiscoveryPaths);
test('uses compiled Platform paths in the Nest runtime', testNestDiscoveryPaths);
test('coerces bounded Platform environment values', testNumericEnvironmentCoercion);
test('rejects invalid Platform environment values', testInvalidEnvironment);
