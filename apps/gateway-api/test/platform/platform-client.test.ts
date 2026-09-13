import { ConfigService } from '@nestjs/config';
import { afterEach, expect, test, vi } from 'vitest';

import { PlatformClient } from '../../src/platform/platform-client';
import { PlatformHttpTransport } from '../../src/platform/platform-http-transport';
import {
  PlatformInvalidResponseException,
  PlatformRejectedRequestException,
  PlatformRequestFailedException,
  PlatformUnavailableException,
} from '../../src/platform/platform.errors';

/** Creates a Platform client with deterministic test configuration. */
function createClient(): PlatformClient {
  const configService = new ConfigService({
    PLATFORM_BASE_URL: 'http://platform-service:8083/',
    PLATFORM_REQUEST_TIMEOUT_MS: 5000,
  });

  return new PlatformClient(new PlatformHttpTransport(configService));
}

/** Restores process globals changed by Platform client tests. */
function restoreGlobals(): void {
  vi.unstubAllGlobals();
}

/** Verifies dynamic document-type identifiers are encoded before transport. */
async function testDocumentTypeRoute(): Promise<void> {
  const response = {
    documentType: {
      label: 'Supplier invoice',
      sections: [
        {
          fields: [
            {
              id: 'number',
              inputType: 'text',
              label: 'Number',
              path: 'header.number',
            },
          ],
          id: 'header',
          label: 'Header',
          path: 'header',
          repeatable: false,
        },
      ],
      type: 'supplier/invoice',
      version: 1,
    },
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  await createClient().getDocumentType('supplier/invoice');

  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    'http://platform-service:8083/internal/v1/document-types/supplier%2Finvoice',
  );
}

/** Verifies non-success Platform responses map without exposing their body. */
async function testFailedResponse(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('private upstream body', { status: 503 })),
  );

  await expect(createClient().getHealth()).rejects.toBeInstanceOf(PlatformRequestFailedException);
}

/** Verifies the client calls the versioned health route and forwards safe correlation. */
async function testHealthContract(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ service: 'platform-service', status: 'ok' }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await expect(createClient().getHealth({ requestId: 'm04.1-a:test' })).resolves.toEqual({
    service: 'platform-service',
    status: 'ok',
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://platform-service:8083/internal/v1/health');
  expect(new Headers(options.headers).get('x-request-id')).toBe('m04.1-a:test');
}

/** Verifies malformed Platform payloads map to the typed invalid-response error. */
async function testInvalidResponse(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ service: 'platform-service', status: 'wrong' }), {
        status: 200,
      }),
    ),
  );

  await expect(createClient().getHealth()).rejects.toBeInstanceOf(PlatformInvalidResponseException);
}

/** Verifies oversized Platform payloads fail before their body is consumed. */
async function testOversizedResponse(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('{}', {
        headers: { 'content-length': String(256 * 1024 + 1) },
        status: 200,
      }),
    ),
  );

  await expect(createClient().getHealth()).rejects.toBeInstanceOf(PlatformInvalidResponseException);
}

/** Verifies a response without content length remains bounded while streaming. */
async function testOversizedStreamResponse(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('x'.repeat(256 * 1024 + 1), { status: 200 })),
  );

  await expect(createClient().getHealth()).rejects.toBeInstanceOf(PlatformInvalidResponseException);
}

/** Verifies expected Platform domain failures retain their public HTTP category. */
async function testRejectedRequest(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid email or password', statusCode: 401 }), {
        status: 401,
      }),
    ),
  );

  const error = await createClient()
    .signIn({ email: 'reviewer@example.test', password: 'wrong-password' })
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(PlatformRejectedRequestException);
  expect((error as PlatformRejectedRequestException).getStatus()).toBe(401);
}

/** Verifies auth commands use validated JSON and the versioned Platform route. */
async function testSignInContract(): Promise<void> {
  const response = {
    accessToken: 'token',
    user: {
      createdAt: '2026-09-12T00:00:00.000Z',
      displayName: 'Reviewer',
      email: 'reviewer@example.test',
      id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
      roles: ['CORRECTOR'],
      scopes: ['corrections:write'],
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const request = { email: 'reviewer@example.test', password: 'password' };
  await expect(createClient().signIn(request, { requestId: 'm04.1-b:test' })).resolves.toEqual(
    response,
  );

  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://platform-service:8083/internal/v1/auth/sign-in');
  expect(options.method).toBe('POST');
  expect(options.body).toBe(JSON.stringify(request));
  expect(new Headers(options.headers).get('content-type')).toBe('application/json');
  expect(new Headers(options.headers).get('x-request-id')).toBe('m04.1-b:test');
}

/** Verifies connection failures map to the typed unavailable error. */
async function testUnavailableResponse(): Promise<void> {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection failed')));

  await expect(createClient().getHealth()).rejects.toBeInstanceOf(PlatformUnavailableException);
}

/** Verifies unsafe correlation input is not forwarded to Platform. */
async function testUnsafeCorrelationIsDropped(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ service: 'platform-service', status: 'ready' }), {
      status: 200,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await createClient().getReadiness({ requestId: 'unsafe request id' });

  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(new Headers(options.headers).has('x-request-id')).toBe(false);
}

afterEach(restoreGlobals);
test('validates Platform health and propagates safe correlation', testHealthContract);
test('posts validated Platform auth commands', testSignInContract);
test('preserves expected Platform domain rejection categories', testRejectedRequest);
test('encodes Platform document-type routes', testDocumentTypeRoute);
test('drops unsafe Platform correlation input', testUnsafeCorrelationIsDropped);
test('maps invalid Platform responses', testInvalidResponse);
test('rejects oversized Platform responses', testOversizedResponse);
test('rejects oversized streaming Platform responses', testOversizedStreamResponse);
test('maps unsuccessful Platform responses', testFailedResponse);
test('maps unavailable Platform responses', testUnavailableResponse);
