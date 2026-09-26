import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

import { createServiceLoggerConfig } from '@aspectloop/backend-platform/logging';

import { GATEWAY_SERVICE_NAME } from '#app/core/service-name';

/**
 * Builds gateway logging from validated application configuration.
 *
 * @param configService Validated gateway configuration.
 * @returns The NestJS Pino module configuration.
 */
export function getPinoLoggerConfig(configService: ConfigService): Params {
  return createServiceLoggerConfig({
    logLevel: configService.get<string>('APP_LOG_LEVEL'),
    nodeEnv: configService.get<string>('NODE_ENV') ?? 'development',
    service: GATEWAY_SERVICE_NAME,
  });
}
