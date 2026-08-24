import type { IncomingMessage, ServerResponse } from 'node:http';

import { expect, test } from 'vitest';

import { createRequestId, isHealthRequest } from '../../src/logging/request-context';
import { TestResponse } from './test-response';

/** Verifies only the exact health route is excluded from automatic logging. */
function testHealthSuppressionContract(): void {
  expect(isHealthRequest({ url: '/health?probe=readiness' } as IncomingMessage)).toBe(true);
  expect(isHealthRequest({ url: '/health/' } as IncomingMessage)).toBe(true);
  expect(
    isHealthRequest({ originalUrl: '/health', url: '/' } as IncomingMessage & {
      originalUrl: string;
    }),
  ).toBe(true);
  expect(isHealthRequest({ url: '/health-report' } as IncomingMessage)).toBe(false);
}

/** Verifies safe caller IDs are preserved and malformed IDs are replaced. */
function testRequestIdContract(): void {
  const acceptedResponse = new TestResponse();
  const acceptedId = createRequestId(
    {
      headers: { 'x-request-id': 'client.request-123' },
    } as unknown as IncomingMessage,
    acceptedResponse as unknown as ServerResponse,
  );

  expect(acceptedId).toBe('client.request-123');
  expect(acceptedResponse.headers.get('x-request-id')).toBe(acceptedId);

  const rejectedResponse = new TestResponse();
  const rejectedId = createRequestId(
    {
      headers: { 'x-request-id': `unsafe-${'x'.repeat(200)}` },
    } as unknown as IncomingMessage,
    rejectedResponse as unknown as ServerResponse,
  );

  expect(rejectedId).toMatch(/^[0-9a-f-]{36}$/);
  expect(rejectedResponse.headers.get('x-request-id')).toBe(rejectedId);
}

test('request IDs are bounded and returned to callers', testRequestIdContract);
test('health log suppression matches only the health endpoint', testHealthSuppressionContract);
