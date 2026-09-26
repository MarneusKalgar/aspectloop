import type { ArgumentsHost } from '@nestjs/common';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { BadRequestException } from '@nestjs/common';
import { PlatformAuthException } from '@platform/auth/platform-auth.exception';
import { PlatformHttpExceptionFilter } from '@platform/internal/platform-http-exception.filter';
import { expect, test, vi } from 'vitest';

interface FilterFixture {
  body: ReturnType<typeof vi.fn>;
  filter: PlatformHttpExceptionFilter;
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
}

/** Creates an isolated HTTP host adapter for exception-filter assertions. */
function createFixture(): FilterFixture {
  const body = vi.fn();
  const response = { json: body, status: vi.fn() };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'request-123' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    body,
    filter: new PlatformHttpExceptionFilter(),
    host,
    status: response.status,
  };
}

/** Verifies allowlisted auth envelopes cross the internal boundary unchanged. */
function testExpectedAuthException(): void {
  const fixture = createFixture();
  const exception = new PlatformAuthException(
    AUTH_ERROR_CODE.SESSION_INVALID,
    'Authentication session is invalid',
  );

  fixture.filter.catch(exception, fixture.host);

  expect(fixture.status).toHaveBeenCalledWith(401);
  expect(fixture.body).toHaveBeenCalledWith(exception.getResponse());
}

/** Verifies safe Nest errors are normalized to the shared bounded envelope. */
function testExpectedGenericException(): void {
  const fixture = createFixture();

  fixture.filter.catch(new BadRequestException('Invalid Platform request'), fixture.host);

  expect(fixture.status).toHaveBeenCalledWith(400);
  expect(fixture.body).toHaveBeenCalledWith({
    message: 'Invalid Platform request',
    statusCode: 400,
  });
}

/** Verifies programming errors never expose their name, message, or stack. */
function testUnexpectedException(): void {
  const fixture = createFixture();

  fixture.filter.catch(new Error('private database detail'), fixture.host);

  expect(fixture.status).toHaveBeenCalledWith(500);
  expect(fixture.body).toHaveBeenCalledWith({
    message: 'Internal server error',
    statusCode: 500,
  });
}

test('preserves validated Platform auth exceptions', testExpectedAuthException);
test('normalizes safe Nest HTTP exceptions', testExpectedGenericException);
test('redacts unexpected exception details', testUnexpectedException);
