import {
  createHttpErrorObject,
  createHttpSuccessObject,
  getHttpCompletionMessage,
  getHttpLogLevel,
} from './http-completion';
import { SENSITIVE_LOG_PATHS } from './redaction-policy';
import { createRequestId, isHealthRequest } from './request-context';

const PINO_LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export interface ServiceLoggerConfigOptions {
  logLevel?: string;
  nodeEnv?: string;
  service: string;
}

type PinoLogLevel = (typeof PINO_LOG_LEVELS)[number];

/**
 * Creates the compact logger contract for a named backend service.
 *
 * @param options Service identity and validated logging configuration.
 * @returns NestJS Pino-compatible module configuration.
 */
export function createServiceLoggerConfig(options: ServiceLoggerConfigOptions) {
  const usePrettyTransport = options.nodeEnv !== 'stage' && options.nodeEnv !== 'production';

  return {
    forRoutes: ['/{*path}'] as ['/{*path}'],
    pinoHttp: {
      autoLogging: { ignore: isHealthRequest },
      base: { service: options.service },
      customAttributeKeys: { reqId: 'requestId' },
      customErrorMessage: getHttpCompletionMessage,
      customErrorObject: createHttpErrorObject,
      customLogLevel: getHttpLogLevel,
      customSuccessMessage: getHttpCompletionMessage,
      customSuccessObject: createHttpSuccessObject,
      genReqId: createRequestId,
      level: getPinoLogLevel(options.logLevel),
      quietReqLogger: true,
      quietResLogger: true,
      redact: {
        paths: SENSITIVE_LOG_PATHS,
        remove: true,
      },
      transport: usePrettyTransport
        ? {
            options: { colorize: true, translateTime: 'SYS:standard' },
            target: 'pino-pretty',
          }
        : undefined,
    },
  };
}

/**
 * Accepts only Pino's bounded level vocabulary and falls back to info.
 *
 * @param value Configured application log level.
 * @returns A supported Pino log level.
 */
function getPinoLogLevel(value: string | undefined): PinoLogLevel {
  return PINO_LOG_LEVELS.includes(value as PinoLogLevel) ? (value as PinoLogLevel) : 'info';
}
