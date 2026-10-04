import { validateEnvironment } from '@aspectloop/backend-platform/config';

import { DatabaseEnvironmentVariables } from './database-env.schema';
import { EnvironmentVariables } from './env.schema';

/**
 * Validates only the configuration required by Platform TypeORM CLI commands.
 *
 * @param config Raw environment configuration supplied to the datasource entry point.
 * @returns A transformed and bounded database configuration.
 */
export function validateDatabaseEnv(config: Record<string, unknown>): DatabaseEnvironmentVariables {
  return validateEnvironment(DatabaseEnvironmentVariables, config);
}

/**
 * Validates raw Platform environment values against the service-owned schema.
 *
 * @param config Raw environment configuration supplied by NestJS.
 * @returns A transformed and validated Platform-service configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const environment = validateEnvironment(EnvironmentVariables, config);
  if (environment.AUTH_SESSION_IDLE_TTL_MS > environment.AUTH_SESSION_ABSOLUTE_TTL_MS) {
    throw new Error(
      'Environment validation failed: AUTH_SESSION_IDLE_TTL_MS must not exceed AUTH_SESSION_ABSOLUTE_TTL_MS',
    );
  }

  return environment;
}
