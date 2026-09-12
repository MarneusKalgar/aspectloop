import { ConfigService } from '@nestjs/config';
import { afterEach, expect, test, vi } from 'vitest';

import { PlatformClient } from '../../src/platform/platform-client';
import {
  PlatformInvalidResponseException,
  PlatformRequestFailedException,
  PlatformUnavailableException,
} from '../../src/platform/platform.errors';

/** Creates a Platform client with deterministic test configuration. */
function createClient(): PlatformClient {
  return new PlatformClient(
    new ConfigService({
      PLATFORM_BASE_URL: 'http://platform-service:8083/',
      PLATFORM_REQUEST_TIMEOUT_MS: 5000,
    }),
  );
}

/** Restores process globals changed by Platform client tests. */
function restoreGlobals(): void {
  vi.unstubAllGlobals();
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
test('drops unsafe Platform correlation input', testUnsafeCorrelationIsDropped);
test('maps invalid Platform responses', testInvalidResponse);
test('rejects oversized Platform responses', testOversizedResponse);
test('rejects oversized streaming Platform responses', testOversizedStreamResponse);
test('maps unsuccessful Platform responses', testFailedResponse);
test('maps unavailable Platform responses', testUnavailableResponse);
