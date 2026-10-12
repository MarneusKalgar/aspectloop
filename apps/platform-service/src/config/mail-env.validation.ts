import { isFQDN } from 'class-validator';
import { isIP } from 'node:net';

import { hasMailControlCharacters, isMailAddress } from '#app/mail/message/mail-message';

/** Validates SMTP/Web inputs without echoing credentials, addresses, or URL contents. */
export function validateMailEnvironment(config: Record<string, unknown>): void {
  const host = config.SMTP_HOST;
  const port = config.SMTP_PORT;
  const secure = config.SMTP_SECURE;
  const user = config.SMTP_USER;
  const password = config.SMTP_PASSWORD;

  if (
    typeof host !== 'string' ||
    host.length === 0 ||
    host.length > 253 ||
    (!isIP(host) && !isFQDN(host, { require_tld: false })) ||
    !isSmtpPort(port) ||
    (secure !== 'true' && secure !== 'false') ||
    !isMailAddress(config.SMTP_FROM)
  ) {
    throw new Error('Environment validation failed: invalid SMTP configuration');
  }

  const hasUser = user !== undefined;
  const hasPassword = password !== undefined;

  if (
    hasUser !== hasPassword ||
    (hasUser && !isSmtpCredential(user, 256)) ||
    (hasPassword && !isSmtpCredential(password, 1024))
  ) {
    throw new Error('Environment validation failed: SMTP credentials must be a bounded pair');
  }

  validatePublicWebOrigin(config.WEB_PUBLIC_BASE_URL);
}

/** Allows one configured Web origin, never caller-supplied routes or token-bearing URLs. */
export function validatePublicWebOrigin(value: unknown): void {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    /\s/.test(value) ||
    hasMailControlCharacters(value)
  ) {
    throw new Error('Environment validation failed: invalid WEB_PUBLIC_BASE_URL');
  }

  try {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      value.includes('?') ||
      value.includes('#') ||
      value.includes('\\')
    ) {
      throw new Error('Invalid origin');
    }
  } catch {
    throw new Error('Environment validation failed: invalid WEB_PUBLIC_BASE_URL');
  }
}

/** Bounds credential memory without accepting empty or control-bearing values. */
function isSmtpCredential(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    !hasMailControlCharacters(value)
  );
}

/** Rejects coercion surprises before the schema transforms an integer SMTP port. */
function isSmtpPort(value: unknown): boolean {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d{1,5}$/.test(value))) {
    return false;
  }

  const port = Number(value);

  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
