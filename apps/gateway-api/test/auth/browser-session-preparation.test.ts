import type { ExecutionContext } from '@nestjs/common';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GraphQLError } from 'graphql';
import { createSchema, createYoga } from 'graphql-yoga';
import { afterEach, expect, test, vi } from 'vitest';

import { PublicBrowserSession } from '../../src/auth/decorators/public-browser-session.decorator';
import { ROLES_KEY } from '../../src/auth/decorators/roles';
import { SCOPES_KEY } from '../../src/auth/decorators/scopes';
import { BrowserSessionGuard } from '../../src/auth/guards/browser-session.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { ScopesGuard } from '../../src/auth/guards/scopes.guard';
import {
  BrowserSessionAuthenticationService,
  type BrowserSessionRequest,
} from '../../src/auth/session/browser-session-authentication.service';
import { BrowserSessionCookieAdapter } from '../../src/auth/session/browser-session-cookie.adapter';
import { BrowserSessionException } from '../../src/auth/session/browser-session.errors';
import { BrowserSessionService } from '../../src/auth/session/browser-session.service';
import {
  type BrowserSessionGraphqlContext,
  createBrowserSessionGraphqlContext,
} from '../../src/graphql/browser-session-context';
import { maskGraphqlError } from '../../src/graphql/errors/mask-graphql-error';
import { recordsSessionActivity } from '../../src/graphql/operation-policy/session-activity.policy';
import { BrowserSessionPlatformClient } from '../../src/platform/browser-session-platform-client';
import { PlatformHttpTransport } from '../../src/platform/platform-http-transport';
import { PlatformUnavailableException } from '../../src/platform/platform.errors';

const CREDENTIAL = `88d58420-dcdb-4d35-a80c-fad8f3d81119.${'a'.repeat(43)}`;
const USER = {
  createdAt: '2026-09-20T00:00:00.000Z',
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: '2026-09-20T00:00:00.000Z',
};
const EXPIRY = '2026-09-27T00:00:00.000Z';

/** Builds the prepared adapter over the real bounded Platform transport. */
function client(): BrowserSessionPlatformClient {
  return new BrowserSessionPlatformClient(
    new PlatformHttpTransport(
      new ConfigService({
        PLATFORM_BASE_URL: 'http://platform.test',
        PLATFORM_REQUEST_TIMEOUT_MS: 5000,
      }),
    ),
  );
}

/** Supplies a controlled private HTTP response without a live Platform process. */
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

/** Restores the transport globals after each isolated HTTP scenario. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The selected operation, including aliases/fragments, owns activity metadata. */
function testActivityPolicy(): void {
  expect(recordsSessionActivity('query { me }')).toBe(false);
  expect(
    recordsSessionActivity(
      'query { me ...Product } fragment Product on Query { c: correctionSession }',
    ),
  ).toBe(true);
  expect(recordsSessionActivity('mutation { saveCorrectionSessionDraft }')).toBe(true);
  expect(
    recordsSessionActivity(`query { me ...Outer ...Outer }
      fragment Outer on Query { ...Product ...Product }
      fragment Product on Query { c: correctionSession }`),
  ).toBe(true);
  expect(
    recordsSessionActivity(`query { me ...Only ...Only }
      fragment Only on Query { me }`),
  ).toBe(false);
  expect(
    recordsSessionActivity(`mutation { ...Outer ...Outer }
      fragment Outer on Mutation { ...Save ...Save }
      fragment Save on Mutation { saveCorrectionSessionDraft }`),
  ).toBe(true);
  expect(
    recordsSessionActivity(
      'query Product { correctionSession } query Bootstrap { me }',
      'Bootstrap',
    ),
  ).toBe(false);
  expect(
    recordsSessionActivity('query Product { correctionSession } query Bootstrap { me }', 'Product'),
  ).toBe(true);
  expect(recordsSessionActivity('query { unknownFutureRoot }')).toBe(false);
  expect(recordsSessionActivity('query {')).toBe(false);
  const request: BrowserSessionRequest = {
    headers: { cookie: `aspectloop_session=${CREDENTIAL}` },
  };
  const publicParams = { query: 'query { me }', recordActivity: true };
  expect(
    createBrowserSessionGraphqlContext({ params: publicParams, req: request, res: new Headers() })
      .browserSession.recordActivity,
  ).toBe(false);
}

/** Real HTTP headers verify host-only cookie scope and failure write policy. */
async function testCookieHttpBoundary(): Promise<void> {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      json({ sessionCredential: CREDENTIAL, sessionExpiresAt: EXPIRY, user: USER }),
    )
    .mockResolvedValueOnce(
      json(
        {
          code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
          message: 'Invalid credentials',
          statusCode: 401,
        },
        401,
      ),
    )
    .mockRejectedValueOnce(new Error('Platform unavailable'));
  vi.stubGlobal('fetch', fetchMock);

  const cookie = new BrowserSessionCookieAdapter('stage');
  const sessionService = new BrowserSessionService(client(), cookie);
  const firstHeaders = new Headers();
  const identity = await sessionService.signIn(
    { email: USER.email, password: 'valid-password' },
    firstHeaders,
  );
  const signInResponse = new Response(JSON.stringify(identity), { headers: firstHeaders });

  expect(identity).toEqual(USER);
  expect(await signInResponse.text()).not.toContain(CREDENTIAL);
  expect(signInResponse.headers.get('set-cookie')).toContain('aspectloop_session=');
  expect(signInResponse.headers.get('set-cookie')).toContain('Path=/graphql');
  expect(signInResponse.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax; Secure');
  expect(signInResponse.headers.get('set-cookie')).toContain(
    'Expires=Sun, 27 Sep 2026 00:00:00 GMT',
  );
  expect(signInResponse.headers.get('set-cookie')).not.toContain('Domain=');
  expect(cookie.read(`other=value; aspectloop_session=${CREDENTIAL}`)).toBe(CREDENTIAL);
  expect(
    cookie.read(`aspectloop_session=${CREDENTIAL}; aspectloop_session=${CREDENTIAL}`),
  ).toBeNull();

  const rejectedHeaders = new Headers();
  await expect(
    sessionService.signIn({ email: USER.email, password: 'bad-password' }, rejectedHeaders),
  ).rejects.toBeInstanceOf(BrowserSessionException);
  expect(rejectedHeaders.has('set-cookie')).toBe(false);

  const signOutHeaders = new Headers();
  await expect(
    sessionService.signOut(`aspectloop_session=${CREDENTIAL}`, signOutHeaders),
  ).rejects.toMatchObject({ code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE });
  expect(signOutHeaders.get('set-cookie')).toContain('Max-Age=0');
  expect(signOutHeaders.get('set-cookie')).toContain('Path=/graphql');
  expect(signOutHeaders.get('set-cookie')).toContain('Secure');
  const calls = fetchMock.mock.calls as [string, RequestInit][];
  expect(calls.map(([url]) => url)).toEqual([
    'http://platform.test/internal/v1/auth/sign-in',
    'http://platform.test/internal/v1/auth/sign-in',
    'http://platform.test/internal/v1/auth/sign-out',
  ]);
  const localHeaders = new Headers();
  new BrowserSessionCookieAdapter('development').clear(localHeaders);
  expect(localHeaders.get('set-cookie')).not.toContain('Secure');
}

/** The opt-in guard defaults closed and existing permission guards read current Platform roles. */
async function testGuardAndPermissions(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(
    json({
      sessionExpiresAt: EXPIRY,
      sessionId: '10000000-0000-4000-8000-000000000001',
      user: USER,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const reflector = new Reflector();
  const authentication = new BrowserSessionAuthenticationService(
    client(),
    new BrowserSessionCookieAdapter('test'),
  );
  const guard = new BrowserSessionGuard(reflector, authentication);
  const handler = () => undefined;
  const request: BrowserSessionRequest = {
    headers: { cookie: `aspectloop_session=${CREDENTIAL}` },
  };
  const context = {
    getClass: () => Object,
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  expect(await guard.canActivate(context)).toBe(true);
  expect(request.user).toMatchObject({ roles: USER.roles, scopes: USER.scopes, sub: USER.id });
  Reflect.defineMetadata(ROLES_KEY, ['CORRECTOR'], handler);
  Reflect.defineMetadata(SCOPES_KEY, ['corrections:write'], handler);
  expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  expect(new ScopesGuard(reflector).canActivate(context)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const publicHandler = () => undefined;
  PublicBrowserSession()(publicHandler);
  const publicContext = {
    ...context,
    getHandler: () => publicHandler,
  } as ExecutionContext;
  expect(await guard.canActivate(publicContext)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
}

/** Missing/duplicate cookies fail before Platform and expected revocation fails closed. */
async function testInvalidSession(): Promise<void> {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      json(
        { code: AUTH_ERROR_CODE.SESSION_INVALID, message: 'Invalid session', statusCode: 401 },
        401,
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  const authentication = new BrowserSessionAuthenticationService(
    client(),
    new BrowserSessionCookieAdapter('test'),
  );
  /** Makes a separate HTTP request object for each rejection case. */
  const request = (cookie: string): BrowserSessionRequest => ({
    headers: { cookie },
  });
  const noActivity = { recordActivity: false };

  await expect(authentication.validate(request(''), noActivity)).rejects.toMatchObject({
    status: 401,
  });
  await expect(
    authentication.validate({ headers: { cookie: undefined } }, noActivity),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    authentication.validate(
      request(`aspectloop_session=${CREDENTIAL}; aspectloop_session=${CREDENTIAL}`),
      noActivity,
    ),
  ).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(
    authentication.validate(request(`aspectloop_session=${CREDENTIAL}`), noActivity),
  ).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
}

/** Real Yoga HTTP composition shares one authoritative validation among roots. */
async function testIsolatedHttpValidation(): Promise<void> {
  const fetchMock = vi.fn().mockResolvedValue(
    json({
      sessionExpiresAt: EXPIRY,
      sessionId: '10000000-0000-4000-8000-000000000001',
      user: USER,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const authentication = new BrowserSessionAuthenticationService(
    client(),
    new BrowserSessionCookieAdapter('test'),
  );
  const yoga = createYoga<Record<never, never>, BrowserSessionGraphqlContext>({
    batching: false,
    /** Reuses the parsed operation for request-wide activity and memoized validation. */
    context: ({ params, request }) =>
      createBrowserSessionGraphqlContext({
        params,
        req: { headers: { cookie: request.headers.get('cookie') } },
        res: new Headers(),
      }),
    cors: false,
    graphiql: false,
    landingPage: false,
    logging: false,
    schema: createSchema<BrowserSessionGraphqlContext>({
      resolvers: {
        Query: {
          /** Uses the same request object as other selected roots. */
          correctionSession: async (
            _root: unknown,
            _args: unknown,
            context: BrowserSessionGraphqlContext,
          ) => {
            await authentication.validate(context.req, context.browserSession);
            return 'product';
          },
          /** Resolves identity only after Platform has validated this request. */
          me: async (_root: unknown, _args: unknown, context: BrowserSessionGraphqlContext) => {
            const user = await authentication.validate(context.req, context.browserSession);
            return user.displayName;
          },
        },
      },
      typeDefs: 'type Query { me: String! correctionSession: String! }',
    }),
  });
  const response = await yoga.fetch('http://gateway.test/graphql', {
    body: JSON.stringify({
      query: `query { me ...Product ...Product }
        fragment Product on Query { correctionSession }`,
    }),
    headers: { 'content-type': 'application/json', cookie: `aspectloop_session=${CREDENTIAL}` },
    method: 'POST',
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: { correctionSession: 'product', me: 'Reviewer' },
  });
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://platform.test/internal/v1/auth/session/validate');
  expect(JSON.parse(options.body as string)).toEqual({
    recordActivity: true,
    sessionCredential: CREDENTIAL,
  });
}

/** Strict target failures prevent malformed upstream payloads from becoming authorization. */
async function testMalformedPlatformFailure(): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(json({ message: 'down', statusCode: 503 }, 503)),
  );
  const authentication = new BrowserSessionAuthenticationService(
    client(),
    new BrowserSessionCookieAdapter('test'),
  );

  await expect(
    authentication.validate(
      { headers: { cookie: `aspectloop_session=${CREDENTIAL}` } },
      { recordActivity: false },
    ),
  ).rejects.toMatchObject({ code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE });
}

/** Preserves only declared session codes and bounded retry metadata in GraphQL. */
function testSessionErrorProjection(): void {
  const outage = maskGraphqlError(
    new GraphQLError('wrapped', {
      originalError: new BrowserSessionException(AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE),
      path: ['me'],
    }),
  );
  expect(outage).toBeInstanceOf(GraphQLError);
  expect((outage as GraphQLError).extensions).toMatchObject({
    code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
  });
  expect((outage as GraphQLError).path).toEqual(['me']);

  const limited = maskGraphqlError(new BrowserSessionException(AUTH_ERROR_CODE.RATE_LIMITED, 2500));
  expect((limited as GraphQLError).extensions).toMatchObject({
    code: AUTH_ERROR_CODE.RATE_LIMITED,
    retryAfterMs: 2500,
  });
}

/** Invalid target envelopes and successes cannot be interpreted as sessions. */
async function testStrictTargetResponsePolicy(): Promise<void> {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      json(
        { code: AUTH_ERROR_CODE.SESSION_INVALID, message: 'Invalid session', statusCode: 401 },
        403,
      ),
    )
    .mockResolvedValueOnce(new Response('not-json', { status: 503 }))
    .mockResolvedValueOnce(json({ sessionId: '10000000-0000-4000-8000-000000000001' }));
  vi.stubGlobal('fetch', fetchMock);
  const platform = client();
  const input = { recordActivity: false, sessionCredential: CREDENTIAL };

  await expect(platform.validate(input)).rejects.toBeInstanceOf(PlatformUnavailableException);
  await expect(platform.validate(input)).rejects.toBeInstanceOf(PlatformUnavailableException);
  await expect(platform.validate(input)).rejects.toBeInstanceOf(PlatformUnavailableException);
  expect(fetchMock).toHaveBeenCalledTimes(3);
}

test('C2a cookie HTTP boundary and outage clear', testCookieHttpBoundary);
test('C2a server-owned activity classification', testActivityPolicy);
test('C2a isolated HTTP validation deduplication', testIsolatedHttpValidation);
test('C2a fail-closed invalid sessions', testInvalidSession);
test('C2a default guard and authoritative permissions', testGuardAndPermissions);
test('C2a malformed Platform failure is unavailable', testMalformedPlatformFailure);
test('C2a endpoint policy rejects invalid target responses', testStrictTargetResponsePolicy);
test('C2b session errors preserve canonical GraphQL extensions', testSessionErrorProjection);
