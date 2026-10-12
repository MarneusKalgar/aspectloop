import 'reflect-metadata';
import type { BrowserSessionAuthenticationService } from '@gateway/auth/session/browser-session-authentication.service';
import type { BrowserSessionService } from '@gateway/auth/session/browser-session.service';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { AuthResolver } from '@gateway/auth/auth.resolver';
import { BrowserSessionException } from '@gateway/auth/session/browser-session.errors';
import { maskGraphqlError } from '@gateway/graphql/errors/mask-graphql-error';
import { createGatewayRequestProtectionPlugin } from '@gateway/graphql/request-protection/gateway-request-protection.plugin';
import { PlatformClient } from '@gateway/platform/platform-client';
import { PlatformHttpTransport } from '@gateway/platform/platform-http-transport';
import {
  PlatformBrowserSessionRejectedException,
  PlatformUnavailableException,
} from '@gateway/platform/platform.errors';
import { ConfigService } from '@nestjs/config';
import { createSchema, createYoga } from 'graphql-yoga';
import { afterEach, expect, test, vi } from 'vitest';

const INPUT = { displayName: 'Reviewer', email: ' Reviewer@Example.Test ', password: ' password ' };

/** Builds real bounded registration transport and resolver, without socket/cookie collaborators. */
function fixture() {
  const session = { signIn: vi.fn(), signOut: vi.fn() };
  const client = new PlatformClient(
    new PlatformHttpTransport(
      new ConfigService({
        PLATFORM_BASE_URL: 'http://platform.test',
        PLATFORM_REQUEST_TIMEOUT_MS: 1000,
      }),
    ),
  );
  const resolver = new AuthResolver(
    client,
    session as unknown as BrowserSessionService,
    {} as BrowserSessionAuthenticationService,
  );
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return { client, fetchMock, resolver, session };
}

/** Returns a bounded test-only envelope; no production token or provider is used. */
function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Restores only process-local test doubles, never contacts actual infrastructure. */
function restore(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

/** Distinguishes valid rate retry metadata from malformed retries and preserves transport failure masking. */
async function testAuthFailures(): Promise<void> {
  const context = fixture();
  context.fetchMock.mockResolvedValueOnce(
    response(
      {
        code: AUTH_ERROR_CODE.RATE_LIMITED,
        message: 'private',
        retryAfterMs: 1000,
        statusCode: 429,
      },
      429,
    ),
  );
  await expect(context.resolver.signUp(INPUT)).rejects.toMatchObject({
    code: AUTH_ERROR_CODE.RATE_LIMITED,
    retryAfterMs: 1000,
  });

  context.fetchMock.mockResolvedValueOnce(
    response(
      {
        code: AUTH_ERROR_CODE.RATE_LIMITED,
        message: 'private',
        statusCode: 429,
      },
      429,
    ),
  );
  await expect(context.resolver.signUp(INPUT)).rejects.toMatchObject({
    code: AUTH_ERROR_CODE.RATE_LIMITED,
  });

  for (const retryAfterMs of [0, 3_600_001, 1.5]) {
    context.fetchMock.mockResolvedValueOnce(
      response(
        {
          code: AUTH_ERROR_CODE.RATE_LIMITED,
          message: 'private',
          retryAfterMs,
          statusCode: 429,
        },
        429,
      ),
    );
    await expect(context.resolver.signUp(INPUT)).rejects.toMatchObject({
      code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
    });
  }

  context.fetchMock.mockRejectedValueOnce(new TypeError('private connection details'));
  await expect(context.resolver.confirmEmail({ token: 'malformed' })).rejects.toMatchObject({
    code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
  });
  context.fetchMock.mockResolvedValueOnce(response({ extra: true, success: true }));
  await expect(context.client.confirmEmail({ token: 'malformed' })).rejects.toBeInstanceOf(
    PlatformUnavailableException,
  );
  context.fetchMock.mockResolvedValueOnce(
    response({ code: AUTH_ERROR_CODE.CONFIRMATION_INVALID, message: 'safe', statusCode: 400 }, 400),
  );
  await expect(context.client.confirmEmail({ token: 'malformed' })).rejects.toBeInstanceOf(
    PlatformBrowserSessionRejectedException,
  );
}

/** Verifies generic projection, exact credential bytes and fixed endpoint selection. */
async function testGenericProjection(): Promise<void> {
  const context = fixture();
  context.fetchMock.mockImplementation(
    /** Supplies fresh single-use response streams to each command. */
    async () => response({ success: true }),
  );
  await expect(context.resolver.signUp(INPUT)).resolves.toEqual({ success: true, user: null });
  await expect(context.resolver.resendEmailConfirmation({ email: INPUT.email })).resolves.toEqual({
    success: true,
  });
  await expect(context.resolver.confirmEmail({ token: 'malformed' })).resolves.toEqual({
    success: true,
  });
  expect(
    context.fetchMock.mock.calls.map(
      /** Reads only fixed route names from the transport calls. */
      ([url]) => new URL(String(url)).pathname,
    ),
  ).toEqual([
    '/internal/v1/auth/sign-up',
    '/internal/v1/auth/resend-email-confirmation',
    '/internal/v1/auth/confirm-email',
  ]);
  expect(JSON.parse(String(context.fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
    ...INPUT,
    email: 'reviewer@example.test',
  });
  expect(context.session.signIn).not.toHaveBeenCalled();
  expect(context.session.signOut).not.toHaveBeenCalled();
}

/** Pins real Yoga variable coercion, masking and request policy without opening a socket or calling Platform. */
async function testGraphqlInputShapeRejection(): Promise<void> {
  const domainCall = vi.fn().mockReturnValue({ success: true });
  const origin = 'http://localhost:5173';
  const yoga = createYoga<{ req: { socket: { remoteAddress: string } } }>({
    batching: false,
    cors: false,
    graphiql: false,
    landingPage: false,
    logging: false,
    maskedErrors: { maskError: maskGraphqlError },
    plugins: [createGatewayRequestProtectionPlugin([origin])],
    schema: createSchema({
      resolvers: { Mutation: { confirmEmail: domainCall } },
      typeDefs: /* GraphQL */ `
        type Query {
          ping: Int
        }
        input ConfirmEmailInput {
          token: String!
        }
        type ConfirmEmailPayload {
          success: Boolean!
        }
        type Mutation {
          confirmEmail(input: ConfirmEmailInput!): ConfirmEmailPayload!
        }
      `,
    }),
  });
  const query =
    'mutation Confirm($input: ConfirmEmailInput!) { confirmEmail(input: $input) { success } }';
  const result = await yoga.fetch(
    'http://gateway.test/graphql',
    {
      body: JSON.stringify({
        query,
        variables: { input: { token: 'malformed', unexpected: true } },
      }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    },
    { req: { socket: { remoteAddress: '127.0.0.1' } } },
  );
  const body = (await result.json()) as Record<string, unknown>;

  expect(result.status).toBe(200);
  expect(result.headers.has('set-cookie')).toBe(false);
  expect(body).not.toHaveProperty('data');
  expect(body.errors).toEqual([expect.objectContaining({ message: expect.any(String) })]);
  expect(body.errors).toEqual([expect.not.objectContaining({ path: expect.anything() })]);
  expect(domainCall).not.toHaveBeenCalled();
}

/** Keeps empty/oversized/remote-invalid token strings in the same safe public classification. */
async function testInvalidConfirmation(): Promise<void> {
  const context = fixture();
  for (const token of ['', 'x'.repeat(129)]) {
    await expect(context.resolver.confirmEmail({ token })).rejects.toMatchObject({
      code: AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    });
  }
  expect(context.fetchMock).not.toHaveBeenCalled();
  context.fetchMock.mockResolvedValueOnce(
    response(
      {
        code: AUTH_ERROR_CODE.CONFIRMATION_INVALID,
        message: 'private upstream message',
        statusCode: 400,
      },
      400,
    ),
  );
  const error: unknown = await context.resolver.confirmEmail({ token: 'malformed' }).catch(
    /** Retains the classified error privately for fixed-message assertions. */
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(BrowserSessionException);
  expect(maskGraphqlError(error)).toMatchObject({
    extensions: { code: AUTH_ERROR_CODE.CONFIRMATION_INVALID },
    message: 'Confirmation is invalid',
  });
}

/** Enforces the active 254-character registration bound without narrowing sign-in compatibility. */
async function testMailboxBoundary(): Promise<void> {
  const context = fixture();
  const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
  expect(email.length).toBe(254);
  context.fetchMock.mockResolvedValueOnce(response({ success: true }));
  await expect(context.client.signUp({ ...INPUT, email })).resolves.toEqual({ success: true });
  context.fetchMock.mockClear();
  await expect(context.client.signUp({ ...INPUT, email: `${email}d` })).rejects.toThrow(
    'Platform request is invalid',
  );
  await expect(context.client.resendEmailConfirmation({ email: `${email}d` })).rejects.toThrow(
    'Platform request is invalid',
  );
  expect(context.fetchMock).not.toHaveBeenCalled();
}

/** Refuses legacy/user-bearing/malformed success and every unrecognized auth error envelope. */
async function testStrictAuthPolicy(): Promise<void> {
  const context = fixture();
  for (const body of [
    { success: true, user: { id: 'private-id' } },
    { success: false },
    { success: true, token: 'private-token' },
  ]) {
    context.fetchMock.mockResolvedValueOnce(response(body));
    await expect(context.resolver.signUp(INPUT)).rejects.toMatchObject({
      code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
    });
  }
  for (const [status, body] of [
    [409, { message: 'legacy identity conflict', statusCode: 409 }],
    [400, { code: 'UNSUPPORTED_AUTH_CODE', message: 'private', statusCode: 400 }],
    [401, { code: AUTH_ERROR_CODE.CONFIRMATION_INVALID, message: 'private', statusCode: 400 }],
  ] as const) {
    context.fetchMock.mockResolvedValueOnce(response(body, status));
    await expect(
      context.resolver.resendEmailConfirmation({ email: INPUT.email }),
    ).rejects.toMatchObject({ code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE });
  }
}

afterEach(restore);
test('registration projects generic results and uses no session service', testGenericProjection);
test('invalid confirmation strings keep the fixed auth rejection', testInvalidConfirmation);
test(
  'registration transport refuses malformed success and unsupported errors',
  testStrictAuthPolicy,
);
test(
  'registration auth failures retain bounded retry and mask transport details',
  testAuthFailures,
);
test('live registration transport enforces the shared mailbox bound', testMailboxBoundary);
test(
  'GraphQL rejects extra input fields before execution even with HTTP 200',
  testGraphqlInputShapeRejection,
);
