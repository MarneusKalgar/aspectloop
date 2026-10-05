import 'reflect-metadata';
import { AuthModule } from '@gateway/auth/auth.module';
import { CorrectionSessionsResolver } from '@gateway/correction-sessions/correction-sessions.resolver';
import { CorrectionSessionsService } from '@gateway/correction-sessions/correction-sessions.service';
import { createBrowserSessionGraphqlContext } from '@gateway/graphql/browser-session-context';
import { maskGraphqlError } from '@gateway/graphql/errors/mask-graphql-error';
import { createGatewayRequestProtectionPlugin } from '@gateway/graphql/request-protection/gateway-request-protection.plugin';
import { HealthController } from '@gateway/health/health.controller';
import { PlatformModule } from '@gateway/platform/platform.module';
import { YogaDriver, type YogaDriverConfig } from '@graphql-yoga/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { afterEach, expect, test, vi } from 'vitest';

const USER = Object.freeze({
  createdAt: '2026-09-20T00:00:00.000Z',
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: '2026-09-20T00:00:00.000Z',
});
const CREDENTIAL = `88d58420-dcdb-4d35-a80c-fad8f3d81119.${'a'.repeat(43)}`;
const ORIGIN = 'http://localhost:5173';
interface TestGraphqlBody {
  data?: Record<string, unknown>;
  errors?: { extensions?: { code?: string } }[];
}

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [
        /** Supplies only safe local configuration to the real Nest composition. */
        () => ({
          CORS_ALLOWED_ORIGINS: ORIGIN,
          NODE_ENV: 'test',
          PLATFORM_BASE_URL: 'http://platform.test',
          PLATFORM_REQUEST_TIMEOUT_MS: 5000,
        }),
      ],
    }),
    PlatformModule,
    AuthModule,
    GraphQLModule.forRoot<YogaDriverConfig>({
      batching: false,
      context: createBrowserSessionGraphqlContext,
      cors: false,
      driver: YogaDriver,
      graphiql: false,
      logging: false,
      maskedErrors: { maskError: maskGraphqlError },
      path: '/graphql',
      plugins: [createGatewayRequestProtectionPlugin([ORIGIN])],
      typeDefs: `
        type User { id: ID! email: String! displayName: String! roles: [String!]!
          scopes: [String!]! createdAt: String! updatedAt: String! }
        type AuthPayload { user: User! }
        type SignOutPayload { success: Boolean! }
        type SignUpPayload { success: Boolean! user: User }
        type CorrectionSession { id: ID! }
        scalar JSON
        input SignInInput { email: String! password: String! }
        input SignUpInput { email: String! password: String! displayName: String! }
        input OpenCorrectionSessionInput { documentId: ID! documentType: String! }
        input SaveCorrectionSessionDraftInput {
          sessionId: ID! expectedVersion: Int! draftPayload: JSON!
        }
        type Query {
          me: User correctionSessions: [CorrectionSession!]!
          correctionSession(sessionId: ID!): CorrectionSession!
        }
        type Mutation { signIn(input: SignInInput!): AuthPayload!
          signOut: SignOutPayload! signUp(input: SignUpInput!): SignUpPayload!
          openCorrectionSession(input: OpenCorrectionSessionInput!): CorrectionSession!
          saveCorrectionSessionDraft(input: SaveCorrectionSessionDraftInput!): CorrectionSession!
        }
      `,
    }),
  ],
  providers: [
    CorrectionSessionsResolver,
    {
      provide: CorrectionSessionsService,
      useValue: { listSessions: vi.fn().mockResolvedValue([]) },
    },
  ],
})
class SessionCompositionTestModule {}

/** Restores fetch and all transport stubs after the real Nest application closes. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Returns a strict JSON Platform response for the transport boundary. */
function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

/** Posts GraphQL and optional directive variables through the real Nest/Express listener. */
async function post(
  baseUrl: string,
  query: string,
  cookie?: string,
  variables?: Record<string, unknown>,
): Promise<{ body: TestGraphqlBody; response: Response }> {
  const response = await fetch(`${baseUrl}/graphql`, {
    body: JSON.stringify({ query, variables }),
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    method: 'POST',
  });
  const body = (await response.json()) as TestGraphqlBody;
  return { body, response };
}

/** Reads a selected response path without loosening the test's JSON type. */
function readPath(body: TestGraphqlBody, ...path: string[]): unknown {
  let value: unknown = body.data;

  for (const key of path) {
    if (value === null || typeof value !== 'object' || !(key in value)) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/** Exercises real Nest providers, guards, Yoga context, and HTTP cookie projection. */
async function testNestSessionComposition(): Promise<void> {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const upstreamCalls: { body: Record<string, unknown>; path: string }[] = [];
  let failValidation = false;
  /** Routes only Platform requests to controlled responses; local Nest calls use real fetch. */
  vi.stubGlobal('fetch', async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);

    if (!url.startsWith('http://platform.test/')) {
      return originalFetch(input, init);
    }

    const path = new URL(url).pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    upstreamCalls.push({ body, path });

    if (path.endsWith('/sign-in')) {
      return json({
        sessionCredential: CREDENTIAL,
        sessionExpiresAt: '2030-09-27T00:00:00.000Z',
        user: USER,
      });
    }

    if (path.endsWith('/session/validate')) {
      if (failValidation) {
        throw new Error('Controlled Platform outage');
      }

      return json({
        sessionExpiresAt: '2030-09-27T00:00:00.000Z',
        sessionId: '88d58420-dcdb-4d35-a80c-fad8f3d81119',
        user: USER,
      });
    }

    if (path.endsWith('/sign-out')) {
      return json({ success: true });
    }

    return json({ service: 'platform-service', status: 'ready' });
  });

  const app = await NestFactory.create(SessionCompositionTestModule, { logger: false });

  try {
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const health = await originalFetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const readiness = await originalFetch(`${baseUrl}/health/readiness`);
    expect(readiness.status).toBe(200);

    const signIn = await post(
      baseUrl,
      `mutation {
        signIn(input: { email: "reviewer@example.test", password: "password" }) {
          user { id email createdAt updatedAt }
        }
      }`,
    );
    expect(readPath(signIn.body, 'signIn', 'user', 'id')).toBe(USER.id);
    const cookie = signIn.response.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).toContain('aspectloop_session=');
    expect(signIn.response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(signIn.response.headers.getSetCookie()).toHaveLength(2);
    expect(signIn.response.headers.getSetCookie()[1]).toContain(
      'aspectloop_access_token=; Path=/;',
    );

    const mixed = await post(
      baseUrl,
      'query { me { id email createdAt updatedAt } correctionSessions { id } }',
      cookie,
    );
    expect(readPath(mixed.body, 'me')).toMatchObject({ email: USER.email, id: USER.id });
    expect(readPath(mixed.body, 'correctionSessions')).toEqual([]);
    expect(upstreamCalls.filter((call) => call.path.endsWith('/session/validate'))).toHaveLength(1);
    expect(
      upstreamCalls.find((call) => call.path.endsWith('/session/validate'))?.body,
    ).toMatchObject({ recordActivity: true });

    const reversed = await post(baseUrl, 'query { correctionSessions { id } me { id } }', cookie);
    expect(readPath(reversed.body, 'me', 'id')).toBe(USER.id);
    expect(upstreamCalls.filter((call) => call.path.endsWith('/session/validate'))).toHaveLength(2);

    const directiveCases: {
      activity: boolean;
      query: string;
      variables?: Record<string, unknown>;
    }[] = [
      {
        activity: false,
        query: 'query { me { id } correctionSessions @skip(if: true) { id } }',
      },
      {
        activity: false,
        query: `query ($skip: Boolean! = true) {
          me { id } correctionSessions @skip(if: $skip) { id }
        }`,
      },
      {
        activity: false,
        query: `query ($include: Boolean!) { me { id } ...Product @include(if: $include) }
          fragment Product on Query { correctionSessions { id } }`,
        variables: { include: false },
      },
      {
        activity: false,
        query: `query ($skip: Boolean!) {
          ... on Query @skip(if: $skip) { correctionSessions { id } } me { id }
        }`,
        variables: { skip: true },
      },
      {
        activity: true,
        query: `query ($skip: Boolean! = true) {
          me { id } correctionSessions @skip(if: $skip) { id }
        }`,
        variables: { skip: false },
      },
      {
        activity: true,
        query: `query ($include: Boolean!) { me { id } ...Product @include(if: $include) }
          fragment Product on Query { correctionSessions { id } }`,
        variables: { include: true },
      },
      {
        activity: true,
        query: `query { me { id } ...Product @skip(if: true) ...Product }
          fragment Product on Query { correctionSessions { id } }`,
      },
    ];

    for (const { activity, query, variables } of directiveCases) {
      const beforeRequest = upstreamCalls.length;
      const result = await post(baseUrl, query, cookie, variables);
      expect(result.body.errors, query).toBeUndefined();
      expect(readPath(result.body, 'me', 'id'), query).toBe(USER.id);
      expect(readPath(result.body, 'correctionSessions'), query).toEqual(activity ? [] : undefined);
      const requestCalls = upstreamCalls.slice(beforeRequest);
      expect(requestCalls, query).toHaveLength(1);
      expect(requestCalls[0], query).toMatchObject({
        body: { recordActivity: activity },
        path: '/internal/v1/auth/session/validate',
      });
    }

    failValidation = true;
    const outage = await post(baseUrl, 'query { me { id } }', cookie);
    expect(outage.body.errors?.[0]?.extensions?.code).toBe('AUTH_DEPENDENCY_UNAVAILABLE');
    expect(outage.response.headers.has('set-cookie')).toBe(false);
    failValidation = false;

    const missing = await post(baseUrl, 'query { me { id } }');
    expect(missing.body.errors?.[0]?.extensions?.code).toBe('AUTH_SESSION_INVALID');
    expect(missing.response.headers.has('set-cookie')).toBe(false);

    const signOut = await post(baseUrl, 'mutation { signOut { success } }', cookie);
    expect(readPath(signOut.body, 'signOut', 'success')).toBe(true);
    expect(signOut.response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(signOut.response.headers.getSetCookie()).toHaveLength(2);
    expect(signOut.response.headers.getSetCookie()[1]).toContain(
      'aspectloop_access_token=; Path=/;',
    );
  } finally {
    await app.close();
  }
}

test('C2b Nest/Express/Yoga browser-session composition', testNestSessionComposition);
