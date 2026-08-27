import { expect, test } from 'vitest';

import { createServiceLoggerConfig } from '../../src/logging';

/** Verifies the shared factory preserves service identity and bounded defaults. */
function testServiceLoggerContract(): void {
  const config = createServiceLoggerConfig({
    logLevel: 'info',
    nodeEnv: 'production',
    service: 'example-service',
  });

  expect(config.pinoHttp.base.service).toBe('example-service');
  expect(config.pinoHttp.quietReqLogger).toBe(true);
  expect(config.pinoHttp.quietResLogger).toBe(true);
  expect(config.pinoHttp.customAttributeKeys.reqId).toBe('requestId');
  expect(config.pinoHttp.redact.remove).toBe(true);
  expect(config.pinoHttp.redact.paths).toContain('authorization');
  expect(config.pinoHttp.redact.paths).toContain('*.passwordHash');
  expect(config.pinoHttp.transport).toBeUndefined();

  const localConfig = createServiceLoggerConfig({
    nodeEnv: 'development',
    service: 'example-service',
  });

  expect(localConfig.pinoHttp.transport?.target).toBe('pino-pretty');
}

test('shared backend logging uses the bounded contract', testServiceLoggerContract);
