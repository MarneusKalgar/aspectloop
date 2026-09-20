import type { PlatformAuthErrorResponse } from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_HTTP_STATUS,
  AUTH_ERROR_POLICY,
  platformAuthErrorResponseSchema,
} from '@aspectloop/contracts/platform';
import { HttpException } from '@nestjs/common';

type PlatformAuthErrorCode = PlatformAuthErrorResponse['code'];

/** Emits only the allowlisted internal auth error envelope. */
export class PlatformAuthException extends HttpException {
  /**
   * Creates a safe Platform auth error with code-specific HTTP and retry metadata.
   *
   * @param code Stable machine-readable Platform auth error code.
   * @param message Safe bounded diagnostic intended for the Gateway boundary.
   * @param retryAfterMs Optional bounded rate-limit retry duration.
   */
  constructor(code: PlatformAuthErrorCode, message: string, retryAfterMs?: number) {
    const statusCode = platformAuthStatus(code);
    const response = platformAuthErrorResponseSchema.parse({
      code,
      message,
      ...(code === AUTH_ERROR_CODE.REFRESH_CONFLICT
        ? { retryAfterMs: AUTH_ERROR_POLICY.REFRESH_CONFLICT_RETRY_AFTER_MS }
        : {}),
      ...(code === AUTH_ERROR_CODE.RATE_LIMITED && retryAfterMs !== undefined
        ? { retryAfterMs }
        : {}),
      statusCode,
    });

    super(response, statusCode);
  }
}

/** Maps a Platform-produced auth code to its fixed transport status. */
function platformAuthStatus(code: PlatformAuthErrorCode): number {
  switch (code) {
    case AUTH_ERROR_CODE.CONFIRMATION_INVALID:
      return AUTH_ERROR_HTTP_STATUS.CONFIRMATION_INVALID;
    case AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE:
      return AUTH_ERROR_HTTP_STATUS.DEPENDENCY_UNAVAILABLE;
    case AUTH_ERROR_CODE.EMAIL_UNVERIFIED:
      return AUTH_ERROR_HTTP_STATUS.EMAIL_UNVERIFIED;
    case AUTH_ERROR_CODE.INVALID_CREDENTIALS:
      return AUTH_ERROR_HTTP_STATUS.INVALID_CREDENTIALS;
    case AUTH_ERROR_CODE.RATE_LIMITED:
      return AUTH_ERROR_HTTP_STATUS.RATE_LIMITED;
    case AUTH_ERROR_CODE.REFRESH_CONFLICT:
      return AUTH_ERROR_HTTP_STATUS.REFRESH_CONFLICT;
    case AUTH_ERROR_CODE.SESSION_INVALID:
      return AUTH_ERROR_HTTP_STATUS.SESSION_INVALID;
  }
}
