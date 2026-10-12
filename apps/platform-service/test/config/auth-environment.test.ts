import { expect, test } from 'vitest';

import { validateEnv } from '../../src/config/env.validation';

const VALID_ENVIRONMENT = {
  AUTH_TOKEN_HMAC_SECRET: 'test-only-hmac-secret-at-least-32-bytes',
  DATABASE_URL: 'postgresql://platform_runtime:platform_runtime@postgres:5432/platform_db',
  NODE_ENV: 'test',
  PLATFORM_S3_ACCESS_KEY_ID: 'test-access-key',
  PLATFORM_S3_BUCKET: 'aspectloop-platform-source',
  PLATFORM_S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_ENDPOINT: 'http://garage:3900',
  S3_FORCE_PATH_STYLE: 'true',
  S3_REGION: 'garage',
  S3_REQUEST_TIMEOUT_MS: '5000',
  SMTP_FROM: 'no-reply@example.test',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  WEB_PUBLIC_BASE_URL: 'http://localhost:5173',
};

/** Verifies auth defaults are transformed into the browser-session contract. */
function testAuthDefaults(): void {
  const environment = validateEnv(VALID_ENVIRONMENT);

  expect(environment).toMatchObject({
    AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS: 60_000,
    AUTH_EMAIL_CONFIRMATION_TTL_MS: 86_400_000,
    AUTH_SESSION_ABSOLUTE_TTL_MS: 604_800_000,
    AUTH_SESSION_IDLE_TTL_MS: 86_400_000,
  });
}

/** Verifies HMAC strength and session-duration ordering fail closed. */
function testInvalidAuthEnvironment(): void {
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, AUTH_TOKEN_HMAC_SECRET: 'too-short' })).toThrow(
    'Environment validation failed',
  );

  expect(() =>
    validateEnv({
      ...VALID_ENVIRONMENT,
      AUTH_TOKEN_HMAC_SECRET: 'replace-with-at-least-32-characters',
    }),
  ).toThrow('Environment validation failed');
  expect(() => validateEnv({ ...VALID_ENVIRONMENT, BCRYPT_SALT_ROUNDS: '16' })).toThrow(
    'Environment validation failed',
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
