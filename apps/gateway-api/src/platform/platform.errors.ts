import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

import {
  PLATFORM_INVALID_RESPONSE,
  PLATFORM_REQUEST_FAILED,
  PLATFORM_UNAVAILABLE,
} from './platform.constants';

export class PlatformInvalidResponseException extends BadGatewayException {
  /** Maps malformed Platform responses to the stable gateway boundary. */
  constructor() {
    super({
      code: PLATFORM_INVALID_RESPONSE,
      message: 'Platform service returned an invalid response',
    });
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
