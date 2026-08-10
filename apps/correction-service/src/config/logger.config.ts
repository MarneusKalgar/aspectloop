import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';
import { IncomingMessage } from 'node:http';

/**
 * Builds correction-service logging from validated application configuration.
 *
 * @param configService Validated service configuration.
 * @returns The NestJS Pino module configuration.
 */
export function getPinoLoggerConfig(configService: ConfigService): Params {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const usePrettyTransport = nodeEnv !== 'stage' && nodeEnv !== 'production';

  return {
    pinoHttp: {
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.startsWith('/health') ?? false,
      },
      base: { service: 'correction-service' },
      level: configService.get<string>('APP_LOG_LEVEL') ?? 'info',
      transport: usePrettyTransport
        ? {
            options: { colorize: true, translateTime: 'SYS:standard' },
            target: 'pino-pretty',
          }
        : undefined,
    },
  };
}
