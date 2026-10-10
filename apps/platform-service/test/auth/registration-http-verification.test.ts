import type { AuthHttpResult } from '@platform/db/verify/auth-http/client';

import { AuthHttpClient, readAuthHttpBody } from '@platform/db/verify/auth-http/client';
import {
  assertGenericRegistration,
  assertPreExecutionGraphqlRejection,
  assertPublicAuthError,
  REGISTRATION_HTTP_STAGE,
  RegistrationHttpObserver,
  type RegistrationHttpStage,
  reportRegistrationHttpFailure,
} from '@platform/db/verify/auth-http/registration-http.support';
import { afterEach, expect, test, vi } from 'vitest';

/** Restores verifier-only spies after each isolated evidence assertion. */
function restore(): void {
  vi.restoreAllMocks();
}

/** Creates only public response data; this test never opens real HTTP, database or SMTP connections. */
function result(data?: Record<string, unknown>): AuthHttpResult {
  return { data, response: new Response(null, { headers: { 'cache-control': 'no-store' } }) };
}

/** Proves cookie rewriting fails before a verifier can report a preserved session. */
async function testCookieNonChange(): Promise<void> {
  const client = new AuthHttpClient();
  const request = vi.spyOn(client, 'graphql').mockResolvedValue({
    response: new Response(null, {
      headers: { 'cache-control': 'no-store', 'set-cookie': 'aspectloop_session=test-only' },
    }),
  });
  const observer = new RegistrationHttpObserver(client, 'original-user');
  await expect(observer.request('mutation Register', {})).rejects.toThrow();
  expect(request).toHaveBeenCalledOnce();
}

/** Rejects leaked private fields even when generic success is present. */
function testGenericPublicSeparation(): void {
  expect(() =>
    assertGenericRegistration(
      result({ signUp: { success: true, user: { id: 'user' } } }),
      'signUp',
    ),
  ).toThrow();
  expect(() =>
    assertGenericRegistration(
      result({ confirmEmail: { success: true, token: 'test-only' } }),
      'confirmEmail',
    ),
  ).toThrow();
  expect(() =>
    assertGenericRegistration(result({ signUp: { success: true, user: null } }), 'signUp'),
  ).not.toThrow();
}

/** Rejects invalid retry metadata before any live threshold scenario may be called passed. */
function testRetryBounds(): void {
  for (const retryAfterMs of [undefined, 0, 3_600_001, 1.5]) {
    expect(() =>
      assertPublicAuthError(
        {
          errors: [{ extensions: { code: 'AUTH_RATE_LIMITED', retryAfterMs } }],
          response: new Response(null),
        },
        'AUTH_RATE_LIMITED',
      ),
    ).toThrow();
  }
}

/** Proves every success/error must preserve the original server-side identity, not just omit cookies. */
async function testServerSessionPreservation(): Promise<void> {
  const client = new AuthHttpClient();
  const request = vi.spyOn(client, 'graphql');
  const observer = new RegistrationHttpObserver(client, 'original-user');
  request.mockResolvedValueOnce(result({ signUp: { success: true, user: null } }));
  request.mockResolvedValueOnce(result({ me: { id: 'different-user' } }));
  await expect(observer.request('mutation Register', {})).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
}

afterEach(restore);
test(
  'HTTP evidence requires original session authority after registration',
  testServerSessionPreservation,
);
test('HTTP evidence refuses any registration cookie write', testCookieNonChange);
test('HTTP evidence refuses user/token disclosure in generic roots', testGenericPublicSeparation);
test('HTTP rate evidence requires bounded integer retry metadata', testRetryBounds);

/** Bounds verifier payloads and ensures JSON failures never expose private parser diagnostics. */
async function testBoundedHttpBody(): Promise<void> {
  await expect(readAuthHttpBody(new Response('x'.repeat(131_073)))).rejects.toThrow(
    'Auth HTTP response is malformed',
  );
  await expect(readAuthHttpBody(new Response('private-token-not-json'))).rejects.toThrow(
    'Auth HTTP response is malformed',
  );
  await expect(readAuthHttpBody(new Response('{"success":true}'))).resolves.toEqual({
    success: true,
  });
}

test('HTTP verifier bounds bodies and masks private parse diagnostics', testBoundedHttpBody);

/** Distinguishes errors-only coercion failures from execution, success and unrelated HTTP failures. */
async function testPreExecutionRejection(): Promise<void> {
  const errors = [{ message: 'Fixed test-only rejection' }];

  for (const status of [200, 400]) {
    await expect(
      assertPreExecutionGraphqlRejection(new Response(JSON.stringify({ errors }), { status })),
    ).resolves.toBeUndefined();
  }

  for (const body of [
    { data: { confirmEmail: { success: true } } },
    { data: null, errors },
    { errors: [] },
    { errors: [{ message: 'Fixed test-only rejection', path: ['confirmEmail'] }] },
    { errors: [{}] },
  ]) {
    await expect(
      assertPreExecutionGraphqlRejection(new Response(JSON.stringify(body))),
    ).rejects.toThrow();
  }

  for (const status of [403, 429, 500]) {
    await expect(
      assertPreExecutionGraphqlRejection(new Response(JSON.stringify({ errors }), { status })),
    ).rejects.toThrow();
  }

  await expect(
    assertPreExecutionGraphqlRejection(
      new Response(JSON.stringify({ errors }), { headers: { 'set-cookie': 'test-only' } }),
    ),
  ).rejects.toThrow();
}

test(
  'HTTP shape evidence requires an errors-only pre-execution rejection',
  testPreExecutionRejection,
);

/** Carries the original cookie into pre-execution rejection probes without accepting redirects. */
async function testRejectedRequestCookie(): Promise<void> {
  const client = new AuthHttpClient();
  const cookie = 'aspectloop_session=test-only';
  client.acceptIssuedCookie(
    new Response(null, {
      headers: {
        'set-cookie': `${cookie}; Path=/graphql; HttpOnly; SameSite=Lax`,
      },
    }),
  );
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    /** Supplies independent public response streams without contacting the fixed local endpoint. */
    async () => new Response(null),
  );
  vi.stubGlobal('fetch', fetchMock);

  try {
    await client.postRaw([]);
    await client.requestDeniedOrigin('mutation Rejected', {});

    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('cookie')).toBe(cookie);
      expect(options?.redirect).toBe('error');
    }
  } finally {
    vi.unstubAllGlobals();
  }
}

test(
  'HTTP rejection probes retain the original cookie and fixed destinations',
  testRejectedRequestCookie,
);

/** Restricts live-failure output to fixed stages even if an unsafe value reaches the reporting boundary. */
function testClosedFailureStages(): void {
  const report = vi.spyOn(console, 'error').mockReturnValue(undefined);
  reportRegistrationHttpFailure(REGISTRATION_HTTP_STAGE.SIGN_UP);
  reportRegistrationHttpFailure('private-token/provider-diagnostic' as RegistrationHttpStage);

  expect(report.mock.calls).toEqual([
    ['D3-EMAIL-signup failed; private details omitted.'],
    ['D3-EMAIL-unknown failed; private details omitted.'],
  ]);
}

test(
  'HTTP verifier reports only closed failure stages, never private diagnostics',
  testClosedFailureStages,
);
