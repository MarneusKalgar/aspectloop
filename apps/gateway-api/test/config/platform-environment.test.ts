import { validateEnv } from '@gateway/config/env.validation';
import { expect, test } from 'vitest';

const VALID_ENVIRONMENT = {
  API_PORT: '8080',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  DATABASE_URL:
    'postgresql://gateway_correction_runtime:gateway_correction_runtime@postgres:5432/platform_db',
  JWT_ACCESS_SECRET: 'test-only-secret',
  NODE_ENV: 'test',
  PERSISTENCE_BASE_URL: 'http://persistence-mock:8090',
  PLATFORM_BASE_URL: 'http://platform-service:8083',
  PLATFORM_REQUEST_TIMEOUT_MS: '5000',
  RABBITMQ_HOST: 'rabbitmq',
  RABBITMQ_PASSWORD: 'test-password',
  RABBITMQ_PORT: '5672',
  RABBITMQ_USER: 'test-user',
};

/** Verifies the Platform client boundary rejects invalid URLs and excess timeouts. */
function testInvalidPlatformClientEnvironment(): void {
  expect(() =>
    validateEnv({
      ...VALID_ENVIRONMENT,
      PLATFORM_BASE_URL: 'platform-service:8083',
      PLATFORM_REQUEST_TIMEOUT_MS: '30001',
    }),
  ).toThrow('Environment validation failed:');
}

test('rejects invalid Platform client configuration', testInvalidPlatformClientEnvironment);
