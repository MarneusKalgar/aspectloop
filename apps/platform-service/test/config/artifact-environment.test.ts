import { validateEnv } from '@platform/config/env.validation';
import { expect, test } from 'vitest';

const VALID_ENVIRONMENT = {
  AUTH_TOKEN_HMAC_SECRET: 'test-only-hmac-secret-at-least-32-bytes',
  DATABASE_URL: 'postgresql://platform_runtime:platform_runtime@postgres:5432/platform_db',
  JWT_ACCESS_SECRET: 'test-only-access-secret-at-least-32-bytes',
  NODE_ENV: 'test',
  PLATFORM_S3_ACCESS_KEY_ID: 'test-access-key',
  PLATFORM_S3_BUCKET: 'aspectloop-platform-source',
  PLATFORM_S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_ENDPOINT: 'http://garage:3900',
  S3_FORCE_PATH_STYLE: 'true',
  S3_REGION: 'garage',
  S3_REQUEST_TIMEOUT_MS: '5000',
};

/** Verifies malformed endpoint, bucket, path-style, and timeout values fail closed. */
function testInvalidArtifactEnvironment(): void {
  expect(() =>
    validateEnv({
      ...VALID_ENVIRONMENT,
      PLATFORM_S3_BUCKET: 'Invalid_Bucket',
      S3_ENDPOINT: 'garage:3900',
      S3_FORCE_PATH_STYLE: 'sometimes',
      S3_REQUEST_TIMEOUT_MS: '30001',
    }),
  ).toThrow('Environment validation failed:');
}

/** Verifies the complete bounded platform S3 configuration is transformed. */
function testValidArtifactEnvironment(): void {
  const environment = validateEnv(VALID_ENVIRONMENT);

  expect(environment.S3_REQUEST_TIMEOUT_MS).toBe(5000);
  expect(environment.PLATFORM_S3_BUCKET).toBe('aspectloop-platform-source');
}

test('accepts bounded platform artifact configuration', testValidArtifactEnvironment);
test('rejects invalid platform artifact configuration', testInvalidArtifactEnvironment);
