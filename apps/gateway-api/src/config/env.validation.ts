import { validateEnvironment } from '@aspectloop/backend-platform/config';

import { EnvironmentVariables } from './env.schema';

/**
 * Validates raw gateway environment values against the gateway-owned schema.
 *
 * @param config Raw environment configuration supplied by NestJS.
 * @returns A transformed and validated gateway configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  return validateEnvironment(EnvironmentVariables, config);
}
