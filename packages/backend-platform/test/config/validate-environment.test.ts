import { IsNumber, IsString } from 'class-validator';
import { expect, test } from 'vitest';

import { getEnvFilePaths, validateEnvironment } from '../../src/config';

class TestEnvironment {
  PORT!: number;
  SERVICE_NAME!: string;
}

IsNumber()(TestEnvironment.prototype, 'PORT');
IsString()(TestEnvironment.prototype, 'SERVICE_NAME');

/** Verifies every backend resolves local environment files in override order. */
function testEnvironmentFilePaths(): void {
  expect(getEnvFilePaths('/workspace/service')).toEqual([
    '/workspace/service/.env.local',
    '/workspace/service/.env',
  ]);
}

/** Verifies raw values are instantiated before schema validation. */
function testEnvironmentTransformation(): void {
  const environment = validateEnvironment(TestEnvironment, {
    PORT: 8080,
    SERVICE_NAME: 'test-service',
  });

  expect(environment).toBeInstanceOf(TestEnvironment);
  expect(environment.PORT).toBe(8080);
  expect(environment.SERVICE_NAME).toBe('test-service');
}

/** Verifies schema failures use the shared bounded validation error. */
function testEnvironmentValidationFailure(): void {
  expect(() =>
    validateEnvironment(TestEnvironment, {
      PORT: 'not-a-number',
      SERVICE_NAME: 'test-service',
    }),
  ).toThrow('Environment validation failed:');
}

test('environment values are transformed and validated', testEnvironmentTransformation);
test('invalid environment values fail startup validation', testEnvironmentValidationFailure);
test('environment files use the shared override order', testEnvironmentFilePaths);
