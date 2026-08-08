import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';
import { IncomingMessage } from 'node:http';

/**
 * Builds gateway logging from validated application configuration.
 *
 * @param configService Validated gateway configuration.
 * @returns The NestJS Pino module configuration.
 */
export function getPinoLoggerConfig(configService: ConfigService): Params {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const usePrettyTransport = nodeEnv !== 'stage' && nodeEnv !== 'production';

  return {
    forRoutes: ['/{*path}'],
    pinoHttp: {
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.startsWith('/health') ?? false,
      },
      level: configService.get<string>('APP_LOG_LEVEL') ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      transport: usePrettyTransport
        ? {
            options: { colorize: true, translateTime: 'SYS:standard' },
            target: 'pino-pretty',
          }
        : undefined,
    },
  };
}
