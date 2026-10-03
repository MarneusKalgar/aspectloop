import type { BrowserSessionAuthErrorCode } from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_HTTP_STATUS,
  AUTH_ERROR_POLICY,
} from '@aspectloop/contracts/platform';
import { HttpException } from '@nestjs/common';

import {
  PlatformBrowserSessionRejectedException,
  PlatformUnavailableException,
} from '#app/platform/platform.errors';

const SESSION_ERRORS = Object.freeze({
  [AUTH_ERROR_CODE.CONFIRMATION_INVALID]: Object.freeze({
    message: 'Confirmation is invalid',
    status: AUTH_ERROR_HTTP_STATUS.CONFIRMATION_INVALID,
  }),
  [AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE]: Object.freeze({
    message: 'Authentication dependency is unavailable',
    status: AUTH_ERROR_HTTP_STATUS.DEPENDENCY_UNAVAILABLE,
  }),
  [AUTH_ERROR_CODE.EMAIL_UNVERIFIED]: Object.freeze({
    message: 'Email confirmation is required',
    status: AUTH_ERROR_HTTP_STATUS.EMAIL_UNVERIFIED,
  }),
  [AUTH_ERROR_CODE.INVALID_CREDENTIALS]: Object.freeze({
    message: 'Invalid email or password',
    status: AUTH_ERROR_HTTP_STATUS.INVALID_CREDENTIALS,
  }),
  [AUTH_ERROR_CODE.RATE_LIMITED]: Object.freeze({
    message: 'Too many authentication requests',
    status: AUTH_ERROR_HTTP_STATUS.RATE_LIMITED,
  }),
  [AUTH_ERROR_CODE.SESSION_INVALID]: Object.freeze({
    message: 'Browser session is invalid',
    status: AUTH_ERROR_HTTP_STATUS.SESSION_INVALID,
  }),
} as const satisfies Record<BrowserSessionAuthErrorCode, { message: string; status: number }>);

/** Carries only a fixed public session code, message, and bounded retry interval. */
export class BrowserSessionException extends HttpException {
  readonly retryAfterMs?: number;

  /** Builds a safe public error from the shared target-session vocabulary. */
  constructor(
    readonly code: BrowserSessionAuthErrorCode,
    retryAfterMs?: number,
  ) {
    super(SESSION_ERRORS[code].message, SESSION_ERRORS[code].status);

    if (
      code === AUTH_ERROR_CODE.RATE_LIMITED &&
      retryAfterMs !== undefined &&
      Number.isInteger(retryAfterMs) &&
      retryAfterMs >= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN &&
      retryAfterMs <= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX
    ) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

/** Converts only recognized Platform failures; programming errors retain their identity. */
export function mapBrowserSessionError(error: unknown): Error {
  if (error instanceof PlatformBrowserSessionRejectedException) {
    return new BrowserSessionException(error.code, error.retryAfterMs);
  }

  if (error instanceof PlatformUnavailableException) {
    return new BrowserSessionException(AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE);
  }

  return error instanceof Error ? error : new Error('Unexpected browser session failure');
}
