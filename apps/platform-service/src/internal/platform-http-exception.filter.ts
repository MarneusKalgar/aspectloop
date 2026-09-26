import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import {
  platformAuthErrorResponseSchema,
  platformBrowserSessionAuthErrorResponseSchema,
  platformErrorResponseSchema,
} from '@aspectloop/contracts/platform';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface HttpResponseAdapter {
  json(body: unknown): unknown;
  status(statusCode: number): HttpResponseAdapter;
}

interface RequestWithCorrelationId {
  id?: unknown;
}

interface SafeHttpFailure {
  body: unknown;
  category: 'expected_http' | 'unexpected';
  statusCode: number;
}

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;
const GENERIC_INTERNAL_ERROR = Object.freeze({
  message: 'Internal server error',
  statusCode: INTERNAL_SERVER_ERROR_STATUS,
});

/** Converts all Platform HTTP failures into bounded, contract-safe responses. */
@Catch()
export class PlatformHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PlatformHttpExceptionFilter.name);

  /** Preserves validated HTTP envelopes and hides unexpected exception details. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithCorrelationId>();
    const response = http.getResponse<HttpResponseAdapter>();
    const failure = toSafeHttpFailure(exception);
    const correlationId = readCorrelationId(request.id);
    const diagnostic = {
      category: failure.category,
      ...(correlationId === null ? {} : { correlationId }),
      event: 'platform.http.request.failed',
      outcome: 'failure',
      statusCode: failure.statusCode,
    };

    if (failure.statusCode >= INTERNAL_SERVER_ERROR_STATUS) {
      this.logger.error(diagnostic);
    } else {
      this.logger.warn(diagnostic);
    }

    response.status(failure.statusCode).json(failure.body);
  }
}

/** Accepts only a bounded request correlation identifier for structured diagnostics. */
function readCorrelationId(value: unknown): null | string {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value) ? value : null;
}

/** Validates an expected Nest HTTP response before allowing it across the boundary. */
function toSafeHttpFailure(exception: unknown): SafeHttpFailure {
  if (!(exception instanceof HttpException)) {
    return {
      body: GENERIC_INTERNAL_ERROR,
      category: 'unexpected',
      statusCode: INTERNAL_SERVER_ERROR_STATUS,
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const authResponse = platformAuthErrorResponseSchema.safeParse(response);

  if (authResponse.success && authResponse.data.statusCode === statusCode) {
    return { body: authResponse.data, category: 'expected_http', statusCode };
  }

  const browserSessionResponse = platformBrowserSessionAuthErrorResponseSchema.safeParse(response);

  if (browserSessionResponse.success && browserSessionResponse.data.statusCode === statusCode) {
    return { body: browserSessionResponse.data, category: 'expected_http', statusCode };
  }

  const genericResponse = platformErrorResponseSchema.safeParse(response);

  if (genericResponse.success && genericResponse.data.statusCode === statusCode) {
    return { body: genericResponse.data, category: 'expected_http', statusCode };
  }

  return {
    body: GENERIC_INTERNAL_ERROR,
    category: 'unexpected',
    statusCode: INTERNAL_SERVER_ERROR_STATUS,
  };
}
