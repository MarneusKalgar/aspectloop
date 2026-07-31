import { Params } from 'nestjs-pino';
import { IncomingMessage } from 'node:http';

export function getPinoLoggerConfig(): Params {
  return {
    pinoHttp: {
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.startsWith('/health') ?? false,
      },
      base: { service: 'correction-service' },
      level: process.env.APP_LOG_LEVEL ?? 'info',
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
