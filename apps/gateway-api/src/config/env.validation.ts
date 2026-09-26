import { validateEnvironment } from '@aspectloop/backend-platform/config';

import { getCorsOrigins } from '#app/core/setupCors';

import { EnvironmentVariables } from './env.schema';

/**
 * Validates raw gateway environment values against the gateway-owned schema.
 *
 * @param config Raw environment configuration supplied by NestJS.
 * @returns A transformed and validated gateway configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const environment = validateEnvironment(EnvironmentVariables, config);
  getCorsOrigins(environment.CORS_ALLOWED_ORIGINS);
  return environment;
}
