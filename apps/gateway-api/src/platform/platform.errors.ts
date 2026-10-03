import type { BrowserSessionAuthErrorCode } from '@aspectloop/contracts/platform';

import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  PLATFORM_INVALID_RESPONSE,
  PLATFORM_REQUEST_FAILED,
  PLATFORM_UNAVAILABLE,
} from './platform.constants';

/** Preserves one validated target-session error without retaining upstream bodies. */
export class PlatformBrowserSessionRejectedException extends HttpException {
  /** Carries only the strict code, safe message and optional bounded retry. */
  constructor(
    readonly code: BrowserSessionAuthErrorCode,
    message: string,
    statusCode: number,
    readonly retryAfterMs?: number,
  ) {
    super({ code, message, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) }, statusCode);
  }
}

export class PlatformInvalidRequestException extends BadRequestException {
  /** Rejects a gateway-to-Platform command that violates the shared contract. */
  constructor() {
    super('Platform request is invalid');
  }
}

export class PlatformInvalidResponseException extends BadGatewayException {
  /** Maps malformed Platform responses to the stable gateway boundary. */
  constructor() {
    super({
      code: PLATFORM_INVALID_RESPONSE,
      message: 'Platform service returned an invalid response',
    });
  }
}

export class PlatformRejectedRequestException extends HttpException {
  /** Preserves an expected Platform domain rejection at the public edge. */
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
  }
}

export class PlatformRequestFailedException extends BadGatewayException {
  /** Maps non-success Platform statuses without exposing an upstream body. */
  constructor(statusCode: number) {
    super({
      code: PLATFORM_REQUEST_FAILED,
      message: 'Platform service request failed',
      upstreamStatus: statusCode,
    });
  }
}

export class PlatformUnavailableException extends ServiceUnavailableException {
  /** Maps connection and timeout failures to a stable unavailable response. */
  constructor() {
    super({
      code: PLATFORM_UNAVAILABLE,
      message: 'Platform service is unavailable',
    });
  }
}
