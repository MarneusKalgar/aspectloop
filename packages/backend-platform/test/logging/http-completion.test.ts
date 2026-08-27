import type { IncomingMessage, ServerResponse } from 'node:http';

import { expect, test } from 'vitest';

import { createHttpErrorObject, createHttpSuccessObject } from '../../src/logging/http-completion';
import { TestResponse } from './test-response';

/** Verifies completion serialization cannot retain request or response payloads. */
function testCompletionObjectContract(): void {
  const request = {
    baseUrl: '',
    body: { password: 'not-for-logs' },
    headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
    method: 'post',
    query: { token: 'secret' },
    route: { path: '/graphql' },
    url: '/graphql?token=secret',
  } as unknown as IncomingMessage;
  const response = new TestResponse();
  const event = createHttpSuccessObject(request, response as unknown as ServerResponse, {
    res: { body: { accessToken: 'secret' } },
    responseTime: 12.6,
  });

  expect(event).toEqual({
    durationMs: 13,
    event: 'http.request.completed',
    method: 'POST',
    outcome: 'success',
    route: '/graphql',
    statusCode: 200,
  });
  expect(JSON.stringify(event)).not.toContain('secret');

  response.statusCode = 500;
  const errorEvent = createHttpErrorObject(
    request,
    response as unknown as ServerResponse,
    new Error('secret-error-message'),
    {
      err: new Error('secret-nested-error'),
      responseTime: 4,
    },
  );

  expect(errorEvent.outcome).toBe('server_error');
  expect(JSON.stringify(errorEvent)).not.toContain('secret');
}

test('HTTP completion events omit sensitive request data', testCompletionObjectContract);
