import { expect, test } from 'vitest';

import { validateEnv } from '../../src/config/env.validation';

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

/** Verifies auth defaults are transformed into the fixed session/JWT contract. */
function testAuthDefaults(): void {
  const environment = validateEnv(VALID_ENVIRONMENT);

  expect(environment).toMatchObject({
    AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS: 60_000,
    AUTH_EMAIL_CONFIRMATION_TTL_MS: 86_400_000,
    AUTH_REFRESH_GRACE_MS: 5000,
    AUTH_SESSION_ABSOLUTE_TTL_MS: 604_800_000,
    AUTH_SESSION_IDLE_TTL_MS: 86_400_000,
    JWT_ACCESS_AUDIENCE: 'aspectloop-gateway',
    JWT_ACCESS_ISSUER: 'aspectloop-platform',
    JWT_ACCESS_TTL: '15m',
  });
}

/** Verifies access TTL, HMAC strength, and session-duration ordering fail closed. */
function testInvalidAuthEnvironment(): void {
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, AUTH_TOKEN_HMAC_SECRET: 'too-short' })).toThrow(
    'Environment validation failed',
  );
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
    'Environment validation failed',
  );
  expect(() =>
    validateEnv({
      ...VALID_ENVIRONMENT,
      AUTH_TOKEN_HMAC_SECRET: 'replace-with-at-least-32-characters',
      JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-bytes',
    }),
  ).toThrow('Environment validation failed');
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, BCRYPT_SALT_ROUNDS: '16' })).toThrow(
    'Environment validation failed',
  );
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, JWT_ACCESS_TTL: '16m' })).toThrow(
    'JWT_ACCESS_TTL must be between 1s and 15m',
  );
  expect(() =>
    validateEnv({
      ...VALID_ENVIRONMENT,
      AUTH_SESSION_ABSOLUTE_TTL_MS: '1000',
      AUTH_SESSION_IDLE_TTL_MS: '1001',
    }),
  ).toThrow('AUTH_SESSION_IDLE_TTL_MS must not exceed AUTH_SESSION_ABSOLUTE_TTL_MS');
}

test('applies the fixed Platform authentication defaults', testAuthDefaults);
test('rejects unsafe Platform authentication configuration', testInvalidAuthEnvironment);
