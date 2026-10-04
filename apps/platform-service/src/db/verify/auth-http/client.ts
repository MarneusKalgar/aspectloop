import assert from 'node:assert/strict';

const GATEWAY_GRAPHQL_URL = 'http://gateway-api:8080/graphql';
const PLATFORM_URL = 'http://platform-service:8083';
const ALLOWED_ORIGIN = 'http://localhost:5173';
const REQUEST_TIMEOUT_MS = 10_000;
const SESSION_COOKIE_NAME = 'aspectloop_session';

export interface AuthHttpResult {
  data?: Record<string, unknown>;
  errors?: { extensions?: { code?: string }; message?: string }[];
  response: Response;
}

/** Maintains one opaque cookie in memory without logging its credential. */
export class AuthHttpClient {
  private cookie: null | string = null;

  /** Captures exactly the first issued session cookie after inspecting its attributes. */
  acceptIssuedCookie(response: Response): void {
    const header = response.headers.get('set-cookie');

    if (!header?.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      throw new Error('Gateway did not issue the expected browser cookie');
    }

    assert.match(header, /Path=\/graphql/);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.doesNotMatch(header, /Domain=/);
    const first = header.split(';', 1)[0];
    assert.ok(first && first.length > SESSION_COOKIE_NAME.length + 2);
    this.cookie = first;
  }

  /** Returns the retained cookie only to the verifier's own SQL assertions. */
  currentCookie(): string {
    assert.ok(this.cookie, 'Verifier has no browser-session cookie');
    return this.cookie;
  }

  /** Sends one bounded GraphQL operation through the running Gateway. */
  async graphql(
    query: string,
    variables?: Record<string, unknown>,
    options: { authorization?: string; cookie?: string; origin?: string } = {},
  ): Promise<AuthHttpResult> {
    const headers = new Headers({
      'content-type': 'application/json',
      origin: options.origin ?? ALLOWED_ORIGIN,
    });
    const cookie = options.cookie ?? this.cookie;

    if (options.authorization) {
      headers.set('authorization', options.authorization);
    }

    if (cookie) {
      headers.set('cookie', cookie);
    }

    const response = await fetch(GATEWAY_GRAPHQL_URL, {
      body: JSON.stringify({ query, variables }),
      headers,
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const parsed: unknown = await response.json();

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Gateway returned a malformed GraphQL envelope');
    }

    return { ...(parsed as Record<string, unknown>), response };
  }

  /** Posts a pre-execution rejection case without assuming a parsed result shape. */
  async postRaw(body: unknown): Promise<Response> {
    return fetch(GATEWAY_GRAPHQL_URL, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ALLOWED_ORIGIN },
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** Sends a rejected-origin request without assuming its body is GraphQL JSON. */
  async requestDeniedOrigin(query: string, variables: Record<string, unknown>): Promise<Response> {
    return fetch(GATEWAY_GRAPHQL_URL, {
      body: JSON.stringify({ query, variables }),
      headers: { 'content-type': 'application/json', origin: 'http://unauthorized.invalid' },
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** Calls only a removed private route to prove legacy commands are unavailable. */
  async requestRemovedPrivateRoute(route: 'me' | 'refresh'): Promise<Response> {
    return fetch(`${PLATFORM_URL}/internal/v1/auth/${route}`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }
}

/** Refuses any destination outside the fixed local Compose service names. */
export function assertLocalHttpDestinations(): void {
  const gateway = new URL(GATEWAY_GRAPHQL_URL);
  const platform = new URL(PLATFORM_URL);

  assert.equal(gateway.hostname, 'gateway-api');
  assert.equal(gateway.pathname, '/graphql');
  assert.equal(platform.hostname, 'platform-service');
  assert.equal(gateway.protocol, 'http:');
  assert.equal(platform.protocol, 'http:');
}
