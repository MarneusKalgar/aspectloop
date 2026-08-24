import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

import { createServiceLoggerConfig } from '@aspectloop/backend-platform/logging';

/**
 * Builds correction-service logging from validated application configuration.
 *
 * @param configService Validated correction-service configuration.
 * @returns The NestJS Pino module configuration.
 */
export function getPinoLoggerConfig(configService: ConfigService): Params {
  return createServiceLoggerConfig({
    logLevel: configService.get<string>('APP_LOG_LEVEL'),
    nodeEnv: configService.get<string>('NODE_ENV') ?? 'development',
    service: 'correction-service',
  });
}
