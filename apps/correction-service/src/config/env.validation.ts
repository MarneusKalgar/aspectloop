import { validateEnvironment } from '@aspectloop/backend-platform/config';

import { EnvironmentVariables } from './env.schema';

/**
 * Validates raw correction environment values against the service-owned schema.
 *
 * @param config Raw environment configuration supplied by NestJS.
 * @returns A transformed and validated correction-service configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  return validateEnvironment(EnvironmentVariables, config);
}
