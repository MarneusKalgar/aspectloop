import { GatewayAuthIpLimiter } from '@gateway/graphql/request-protection/auth-ip-limiter';
import { createGatewayRequestProtectionPlugin } from '@gateway/graphql/request-protection/gateway-request-protection.plugin';
import {
  AUTH_OPERATION_NAME,
  AUTH_RATE_LIMIT_POLICIES,
} from '@gateway/graphql/request-protection/operation-policy';
import { createSchema, createYoga } from 'graphql-yoga';
import { expect, test, vi } from 'vitest';

const URL = 'http://gateway.test/graphql';
const ORIGIN = 'http://localhost:5173';

/** Creates a real Yoga HTTP boundary with observable mutation resolvers. */
function createProtectedYoga() {
  const domainCall = vi.fn(() => 'done');
  const schema = createSchema({
    resolvers: {
      Mutation: {
        [AUTH_OPERATION_NAME.CONFIRM_EMAIL]: domainCall,
        [AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION]: domainCall,
        [AUTH_OPERATION_NAME.SIGN_IN]: domainCall,
        [AUTH_OPERATION_NAME.SIGN_OUT]: domainCall,
        [AUTH_OPERATION_NAME.SIGN_UP]: domainCall,
        submitCorrections: domainCall,
      },
      Query: { ping: () => 'pong' },
    },
    typeDefs: /* GraphQL */ `
      type Query {
        ping: String
      }
      type Mutation {
        ${AUTH_OPERATION_NAME.SIGN_IN}: String
        ${AUTH_OPERATION_NAME.SIGN_OUT}: String
        ${AUTH_OPERATION_NAME.SIGN_UP}: String
        ${AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION}: String
        ${AUTH_OPERATION_NAME.CONFIRM_EMAIL}: String
        submitCorrections: String
      }
    `,
  });
  const yoga = createYoga<{ req: { socket: { remoteAddress: string } } }>({
    batching: false,
    cors: false,
    graphiql: false,
    landingPage: false,
    logging: false,
    plugins: [createGatewayRequestProtectionPlugin([ORIGIN])],
    schema,
  });

  return { domainCall, yoga };
}

/** Sends a request with a socket identity independent of forwarded headers. */
async function post(
  yoga: ReturnType<typeof createProtectedYoga>['yoga'],
  body: unknown,
  options: {
    contentType?: string;
    ip?: string;
    origin?: null | string;
    xForwardedFor?: string;
  } = {},
): Promise<Response> {
  return yoga.fetch(
    URL,
    {
      body: JSON.stringify(body),
      headers: {
        'content-type': options.contentType ?? 'application/json',
        ...(options.origin === null ? {} : { origin: options.origin ?? ORIGIN }),
        ...(options.xForwardedFor ? { 'x-forwarded-for': options.xForwardedFor } : {}),
      },
      method: 'POST',
    },
    { req: { socket: { remoteAddress: options.ip ?? '127.0.0.1' } } },
  );
}

/** Proves batches and aliased/fractured session roots have no side effects. */
async function testBatchAndRootIsolation(): Promise<void> {
  const { domainCall, yoga } = createProtectedYoga();

  const batch = await post(yoga, [
    { query: `mutation { ${AUTH_OPERATION_NAME.SIGN_IN} }` },
    { query: 'mutation { submitCorrections }' },
  ]);
  const aliased = await post(yoga, {
    query: `mutation { login: ${AUTH_OPERATION_NAME.SIGN_IN} ...Other }
      fragment Other on Mutation { submitCorrections }`,
  });
  const repeated = await post(yoga, {
    query: `mutation { first: ${AUTH_OPERATION_NAME.SIGN_OUT} second: ${AUTH_OPERATION_NAME.SIGN_OUT} }`,
  });

  expect(batch.status).toBe(400);
  expect(aliased.status).toBe(400);
  expect(repeated.status).toBe(400);
  expect(domainCall).not.toHaveBeenCalled();
}

/** Proves GET cannot execute a product mutation. */
async function testGetMutationDenied(): Promise<void> {
  const { domainCall, yoga } = createProtectedYoga();
  const response = await yoga.fetch(
    `${URL}?query=${encodeURIComponent('mutation { submitCorrections }')}`,
    { method: 'GET' },
    { req: { socket: { remoteAddress: '127.0.0.1' } } },
  );

  expect(response.status).toBe(405);
  expect(domainCall).not.toHaveBeenCalled();
}

/** Proves combined registration limits expire and capacity fails closed. */
function testLimiterWindowAndCapacity(): void {
  let now = 0;
  const limiter = new GatewayAuthIpLimiter(() => now);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.REGISTRATION, '127.0.0.1')).toBeNull();
  }

  expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.REGISTRATION, '127.0.0.1')).toBe(3_600_000);
  now = 3_600_000;
  expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.REGISTRATION, '127.0.0.1')).toBeNull();

  for (let key = 1; key < 10_000; key += 1) {
    expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.CONFIRMATION, `192.0.2.${key}`)).toBeNull();
  }

  expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.CONFIRMATION, '198.51.100.1')).toBe(3_600_000);
  now += 60_000;
  expect(limiter.consume(AUTH_RATE_LIMIT_POLICIES.CONFIRMATION, '198.51.100.1')).toBeNull();
}

/** Proves malformed JSON cannot reflect credential-like input through Yoga errors. */
async function testMalformedJsonRedaction(): Promise<void> {
  const { domainCall, yoga } = createProtectedYoga();
  const response = await yoga.fetch(
    URL,
    {
      body: '{"password":"secret-sentinel",',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      method: 'POST',
    },
    { req: { socket: { remoteAddress: '127.0.0.1' } } },
  );

  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain('secret-sentinel');
  expect(domainCall).not.toHaveBeenCalled();
}

/** Proves browser Origin and JSON are checked before product-domain calls. */
async function testOriginAndJsonGate(): Promise<void> {
  const { domainCall, yoga } = createProtectedYoga();
  const mutation = { query: 'mutation { submitCorrections }' };

  const foreign = await post(yoga, mutation, { origin: 'http://foreign.test' });
  const missing = await post(yoga, mutation, { origin: null });
  const opaque = await post(yoga, mutation, { origin: 'null' });
  const nonJson = await post(yoga, mutation, { contentType: 'text/plain' });

  expect(foreign.status).toBe(403);
  expect(missing.status).toBe(403);
  expect(opaque.status).toBe(403);
  expect(nonJson.status).toBe(415);
  expect(domainCall).not.toHaveBeenCalled();

  const accepted = await post(yoga, mutation);
  expect(accepted.status).toBe(200);
  expect(domainCall).toHaveBeenCalledOnce();
}

/** Proves forwarded-IP spoofing cannot evade the process-local auth limit. */
async function testSignInIpLimit(): Promise<void> {
  const { domainCall, yoga } = createProtectedYoga();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await post(
      yoga,
      { query: `mutation { ${AUTH_OPERATION_NAME.SIGN_IN} }` },
      {
        xForwardedFor: `192.0.2.${attempt + 1}`,
      },
    );
    expect(response.status).toBe(200);
  }

  const rejected = await post(
    yoga,
    { query: `mutation { ${AUTH_OPERATION_NAME.SIGN_IN} }` },
    {
      xForwardedFor: '198.51.100.10',
    },
  );
  const payload = (await rejected.json()) as {
    errors?: { extensions?: { code?: string; retryAfterMs?: number } }[];
  };

  expect(rejected.status).toBe(429);
  expect(payload.errors?.[0]?.extensions?.code).toBe('AUTH_RATE_LIMITED');
  expect(payload.errors?.[0]?.extensions?.retryAfterMs).toBeGreaterThanOrEqual(1);
  expect(payload.errors?.[0]?.extensions?.retryAfterMs).toBeLessThanOrEqual(3_600_000);
  expect(domainCall).toHaveBeenCalledTimes(30);
}

test('gates Origin and JSON before product mutations', testOriginAndJsonGate);
test('does not reflect malformed JSON credentials', testMalformedJsonRedaction);
test('rejects HTTP batches and mixed or repeated session roots', testBatchAndRootIsolation);
test('denies product mutation execution over GET', testGetMutationDenied);
test('limits sign-in by socket IP despite forwarded headers', testSignInIpLimit);
test(
  'bounds registration counters, expires entries, and fails closed on capacity',
  testLimiterWindowAndCapacity,
);
