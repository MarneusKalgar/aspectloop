import { EnvironmentVariables } from '@platform/config/env.schema';
import { validateDatabaseEnv, validateEnv } from '@platform/config/env.validation';
import { validateMailEnvironment } from '@platform/config/mail-env.validation';
import { validateSync } from 'class-validator';
import { expect, test } from 'vitest';

const MAIL_ENVIRONMENT = {
  SMTP_FROM: 'no-reply@example.test',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  WEB_PUBLIC_BASE_URL: 'http://localhost:5173',
};

/** Rejects alternate destinations, URL credentials, queries, fragments, and unsafe protocols. */
function testInvalidOrigins(): void {
  const invalid = [
    '',
    'web.example.test',
    'ftp://web.example.test',
    'https://user:private@web.example.test',
    'https://web.example.test/?token=private',
    'https://web.example.test/#private',
    'https://web.example.test/confirm-email',
    'https://web.example.test/?',
    'https://web.example.test/#',
    'https://web.example.test\\other',
    'https://web.example.test\n',
  ];

  for (const origin of invalid) {
    expect(() =>
      validateMailEnvironment({ ...MAIL_ENVIRONMENT, WEB_PUBLIC_BASE_URL: origin }),
    ).toThrow('invalid WEB_PUBLIC_BASE_URL');
  }
}

/** Rejects ambiguous coercions, invalid ports, header injection, and unpaired credentials. */
function testInvalidSmtp(): void {
  const invalid = [
    { SMTP_HOST: '' },
    { SMTP_HOST: 'smtp.example.test/path' },
    { SMTP_HOST: 'mailpit\r\nsecret' },
    { SMTP_PORT: '0' },
    { SMTP_PORT: '65536' },
    { SMTP_PORT: '1.5' },
    { SMTP_PORT: true },
    { SMTP_PORT: '1e3' },
    { SMTP_SECURE: '1' },
    { SMTP_SECURE: true },
    { SMTP_FROM: 'no-reply@example.test\r\nBcc: private@example.test' },
    { SMTP_FROM: 'Name <no-reply@example.test>' },
    { SMTP_USER: 'user' },
    { SMTP_PASSWORD: 'private' },
    { SMTP_PASSWORD: '', SMTP_USER: '' },
    { SMTP_PASSWORD: 'private\npassword', SMTP_USER: 'user' },
  ];

  for (const settings of invalid) {
    expect(() => validateMailEnvironment({ ...MAIL_ENVIRONMENT, ...settings })).toThrow(
      'Environment validation failed',
    );
  }
}

/** Ensures configuration errors cannot carry private credential or URL values. */
function testPrivateDiagnostics(): void {
  try {
    validateMailEnvironment({ ...MAIL_ENVIRONMENT, SMTP_USER: 'PRIVATE-SENTINEL' });
  } catch (error) {
    expect(String(error)).not.toContain('PRIVATE-SENTINEL');
    expect(String(error)).toContain('SMTP credentials');
  }
}

/** Verifies numeric transformation and that database CLI tooling remains SMTP-independent. */
function testRuntimeAndDatabaseConfiguration(): void {
  const runtime = validateEnv({
    ...MAIL_ENVIRONMENT,
    AUTH_TOKEN_HMAC_SECRET: 'test-only-hmac-secret-at-least-32-bytes',
    DATABASE_URL: 'postgresql://runtime:runtime@postgres:5432/platform_db',
    PLATFORM_S3_ACCESS_KEY_ID: 'test-access-key',
    PLATFORM_S3_BUCKET: 'aspectloop-platform-source',
    PLATFORM_S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_ENDPOINT: 'http://garage:3900',
    S3_REGION: 'garage',
  });

  expect(runtime.SMTP_PORT).toBe(1025);
  expect(() => validateDatabaseEnv({ DATABASE_URL: runtime.DATABASE_URL })).not.toThrow();
  expect(() => validateEnv({ ...runtime, SMTP_HOST: undefined })).toThrow('invalid SMTP');
}

/** Keeps configured sender validation at the same mailbox-length boundary as runtime admission. */
function testSenderLengthSchema(): void {
  const local = 'a'.repeat(64);
  const domainPrefix = `${'b'.repeat(63)}.${'c'.repeat(63)}.`;
  const atLimit = `${local}@${domainPrefix}${'d'.repeat(61)}`;
  const aboveLimit = `${local}@${domainPrefix}${'d'.repeat(62)}`;

  expect(() => validateMailEnvironment({ ...MAIL_ENVIRONMENT, SMTP_FROM: atLimit })).not.toThrow();
  expect(() => validateMailEnvironment({ ...MAIL_ENVIRONMENT, SMTP_FROM: aboveLimit })).toThrow(
    'invalid SMTP configuration',
  );

  const validSchema = Object.assign(new EnvironmentVariables(), { SMTP_FROM: atLimit });
  const invalidSchema = Object.assign(new EnvironmentVariables(), { SMTP_FROM: aboveLimit });
  const validErrors = validateSync(validSchema, { skipMissingProperties: true });
  const invalidErrors = validateSync(invalidSchema, { skipMissingProperties: true });

  const validFields = validErrors.map(
    /** Projects schema evidence without inspecting private configuration values. */
    (error) => error.property,
  );
  const invalidFields = invalidErrors.map(
    /** Projects the rejected sender field without retaining its value. */
    (error) => error.property,
  );

  expect(validFields).not.toContain('SMTP_FROM');
  expect(invalidFields).toContain('SMTP_FROM');
}

/** Accepts local capture and paired authenticated-provider settings without SMTP probes. */
function testValidSettings(): void {
  expect(() => validateMailEnvironment(MAIL_ENVIRONMENT)).not.toThrow();
  expect(() =>
    validateMailEnvironment({
      ...MAIL_ENVIRONMENT,
      SMTP_HOST: 'smtp.example.test',
      SMTP_PASSWORD: 'private-password',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'user',
      WEB_PUBLIC_BASE_URL: 'https://web.example.test',
    }),
  ).not.toThrow();
}

test('accepts bounded SMTP and public-origin settings', testValidSettings);
test('rejects invalid SMTP/header/credential inputs', testInvalidSmtp);
test('rejects unsafe Web origins', testInvalidOrigins);
test('keeps database CLI validation independent of mail', testRuntimeAndDatabaseConfiguration);
test('strips private configuration details', testPrivateDiagnostics);
test('shares the sender length limit between raw validation and schema', testSenderLengthSchema);
