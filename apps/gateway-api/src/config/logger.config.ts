import { Params } from 'nestjs-pino';
import { IncomingMessage } from 'node:http';

export function getPinoLoggerConfig(): Params {
  return {
    forRoutes: ['/{*path}'],
    pinoHttp: {
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.startsWith('/health') ?? false,
      },
      level: process.env.APP_LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      transport:
        process.env.NODE_ENV === 'stage'
          ? undefined
          : {
              options: { colorize: true, translateTime: 'SYS:standard' },
              target: 'pino-pretty',
            },
    },
  };
}
