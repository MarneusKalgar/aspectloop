import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import { AuthSession } from '#app/auth/sessions/model/auth-session.entity';
import { AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS } from '#app/auth/sessions/session.constants';

import type { OwnedAuthFixture } from './fixture';

import { readVerificationDatabaseNow, reportScenario } from '../auth-sessions/verification-support';
import { AuthHttpClient, type AuthHttpResult } from './client';

const SIGN_IN = `mutation SignIn($input: SignInInput!) {
  signIn(input: $input) {
    user { id email displayName roles scopes createdAt updatedAt }
  }
}`;
const ME = 'query Me { me { id email displayName roles scopes createdAt updatedAt } }';
const PRODUCT = 'query Product { correctionSessions { id } }';
const SIGN_OUT = 'mutation SignOut { signOut { success } }';

/** Runs default-stack session checks without displaying private HTTP bodies. */
export async function verifyAuthHttpScenarios(
  cleanup: DataSource,
  fixture: OwnedAuthFixture,
  password: string,
): Promise<void> {
  const first = new AuthHttpClient();
  const second = new AuthHttpClient();

  await verifyRejectedRequests(first, fixture, password);
  const firstSignIn = await first.graphql(SIGN_IN, {
    input: { email: fixture.email, password },
  });
  assert.equal(firstSignIn.response.status, 200);
  assert.equal(readUserId(firstSignIn, 'signIn'), fixture.id);
  const publicSignIn = firstSignIn.data?.signIn;
  assert.ok(isRecord(publicSignIn));
  assert.deepEqual(Object.keys(publicSignIn), ['user']);
  first.acceptIssuedCookie(firstSignIn.response);
  reportScenario(
    'HTTP-SESSION-01',
    'allowed sign-in writes a host-only HttpOnly cookie and public user',
  );

  const issuedCookie = first.currentCookie();
  const wrongSecret = `${issuedCookie.slice(0, -1)}${issuedCookie.endsWith('A') ? 'B' : 'A'}`;
  const invalid = await first.graphql(ME, undefined, { cookie: wrongSecret });
  assert.equal(readErrorCode(invalid), AUTH_ERROR_CODE.SESSION_INVALID);
  assert.equal(invalid.response.headers.has('set-cookie'), false);
  const duplicate = await first.graphql(ME, undefined, {
    cookie: `${issuedCookie}; ${issuedCookie}`,
  });
  assert.equal(readErrorCode(duplicate), AUTH_ERROR_CODE.SESSION_INVALID);
  assert.equal(duplicate.response.headers.has('set-cookie'), false);
  reportScenario(
    'HTTP-SESSION-01A',
    'wrong-secret and duplicate cookies preserve existing cookie state',
  );

  const sessionId = readSessionId(first.currentCookie());
  const issued = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  assert.equal(issued.userId, fixture.id);
  assert.equal(issued.credentialDigest?.length, 64);
  assert.equal(issued.credentialDigest?.includes(first.currentCookie()), false);
  const expiresText = /(?:^|;)\s*Expires=([^;]+)/.exec(
    firstSignIn.response.headers.get('set-cookie') ?? '',
  )?.[1];
  assert.ok(expiresText);
  assert.ok(Math.abs(Date.parse(expiresText) - issued.absoluteExpiresAt.getTime()) < 1000);
  await ageActivity(cleanup, sessionId);
  const beforeMe = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  const me = await first.graphql(ME);
  assert.equal(readUserId(me, 'me'), fixture.id);
  assert.equal(me.response.headers.has('set-cookie'), false);
  const afterMe = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  assert.equal(afterMe.lastActivityAt?.getTime(), beforeMe.lastActivityAt?.getTime());
  reportScenario(
    'HTTP-SESSION-02',
    'complete me projection validates without rewriting cookie or activity',
  );

  const aged = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  const product = await first.graphql(PRODUCT);
  assert.ok(product.data && Array.isArray(product.data.correctionSessions));
  assert.equal(product.response.headers.has('set-cookie'), false);
  const active = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  assert.ok((active.lastActivityAt?.getTime() ?? 0) > (aged.lastActivityAt?.getTime() ?? 0));
  reportScenario('HTTP-SESSION-03', 'protected empty inbox records server-selected activity');

  await ageActivity(cleanup, sessionId);
  const beforeMixed = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  const mixed = await first.graphql(
    'query Mixed { me { id email displayName createdAt updatedAt roles scopes } correctionSessions { id } }',
  );
  assert.equal(readUserId(mixed, 'me'), fixture.id);
  const afterMixed = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  assert.ok(
    (afterMixed.lastActivityAt?.getTime() ?? 0) > (beforeMixed.lastActivityAt?.getTime() ?? 0),
  );

  await ageActivity(cleanup, sessionId);
  const beforeReversed = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: sessionId });
  const reversed = await first.graphql(
    'query Reversed { correctionSessions { id } me { id email displayName createdAt updatedAt roles scopes } }',
  );
  assert.equal(readUserId(reversed, 'me'), fixture.id);
  const afterReversed = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: sessionId });
  assert.ok(
    (afterReversed.lastActivityAt?.getTime() ?? 0) >
      (beforeReversed.lastActivityAt?.getTime() ?? 0),
  );
  reportScenario('HTTP-SESSION-03A', 'mixed me/product roots record activity in either order');

  const secondSignIn = await second.graphql(SIGN_IN, {
    input: { email: fixture.email, password },
  });
  assert.equal(readUserId(secondSignIn, 'signIn'), fixture.id);
  second.acceptIssuedCookie(secondSignIn.response);
  assert.notEqual(first.currentCookie(), second.currentCookie());
  const firstSignOut = await first.graphql(SIGN_OUT);
  assert.equal(readBooleanField(firstSignOut, 'signOut', 'success'), true);
  assert.match(firstSignOut.response.headers.get('set-cookie') ?? '', /Max-Age=0/);
  assert.equal(readErrorCode(await first.graphql(ME)), AUTH_ERROR_CODE.SESSION_INVALID);
  assert.equal(readUserId(await second.graphql(ME), 'me'), fixture.id);
  reportScenario(
    'HTTP-SESSION-04',
    'logout revokes one session and preserves an independent login',
  );

  const secondSignOut = await second.graphql(SIGN_OUT);
  assert.equal(readBooleanField(secondSignOut, 'signOut', 'success'), true);
  assert.equal(readErrorCode(await second.graphql(ME)), AUTH_ERROR_CODE.SESSION_INVALID);
  assert.equal((await first.requestRemovedPrivateRoute('refresh')).status, 404);
  assert.equal((await first.requestRemovedPrivateRoute('me')).status, 404);
  const oldRefresh = await new AuthHttpClient().graphql(
    'mutation { refreshSession { user { id } } }',
  );
  assert.ok(oldRefresh.errors?.length);
  reportScenario('HTTP-SESSION-05', 'old refresh route and operation are unavailable');
}

/** Moves only the fixture-owned activity timestamp past the write throttle. */
async function ageActivity(cleanup: DataSource, sessionId: string): Promise<void> {
  const now = await readVerificationDatabaseNow(cleanup);
  const stale = new Date(now.getTime() - AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS - 1000);
  await cleanup
    .getRepository(AuthSession)
    .update({ id: sessionId }, { createdAt: stale, lastActivityAt: stale });
}

/** Narrows a parsed JSON value before accessing public response fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reads a single scalar from a successful mutation payload. */
function readBooleanField(result: AuthHttpResult, root: string, field: string): unknown {
  const value = result.data?.[root];
  assert.ok(isRecord(value));
  return value[field];
}

/** Extracts only the expected GraphQL auth error code. */
function readErrorCode(result: AuthHttpResult): string | undefined {
  return result.errors?.[0]?.extensions?.code;
}

/** Parses the opaque token identifier without retaining the secret in logs. */
function readSessionId(cookie: string): string {
  const match = /^aspectloop_session=([0-9a-f-]{36})\.[A-Za-z0-9_-]{43}$/.exec(cookie);
  assert.ok(match);
  return match[1];
}

/** Checks that a complete public user contains stable identity and timestamps. */
function readUserId(result: AuthHttpResult, root: string): string {
  const value = result.data?.[root];
  const record = root === 'signIn' && isRecord(value) ? value.user : value;

  assert.ok(isRecord(record));
  assert.equal(typeof record.id, 'string');
  assert.equal(typeof record.email, 'string');
  assert.equal(typeof record.displayName, 'string');
  assert.equal(typeof record.createdAt, 'string');
  assert.equal(typeof record.updatedAt, 'string');
  assert.ok(Array.isArray(record.roles));
  assert.ok(Array.isArray(record.scopes));
  return record.id as string;
}

/** Confirms old credentials and malformed session inputs cannot write cookies. */
async function verifyRejectedRequests(
  client: AuthHttpClient,
  fixture: OwnedAuthFixture,
  password: string,
): Promise<void> {
  const bearerOnly = await client.graphql(ME, undefined, {
    authorization: 'Bearer obsolete-token',
  });
  assert.equal(readErrorCode(bearerOnly), AUTH_ERROR_CODE.SESSION_INVALID);
  assert.equal(bearerOnly.response.headers.has('set-cookie'), false);

  const rejected = await client.graphql(SIGN_IN, {
    input: { email: fixture.email, password: `${password}wrong` },
  });
  assert.equal(readErrorCode(rejected), AUTH_ERROR_CODE.INVALID_CREDENTIALS);
  assert.equal(rejected.response.headers.has('set-cookie'), false);

  const deniedOrigin = await client.requestDeniedOrigin(SIGN_IN, {
    input: { email: fixture.email, password },
  });
  assert.ok(deniedOrigin.status >= 400);
  assert.equal(deniedOrigin.headers.has('set-cookie'), false);

  const batch = await client.postRaw([
    { query: SIGN_IN, variables: { input: { email: fixture.email, password } } },
  ]);
  assert.ok(batch.status >= 400);
  assert.equal(batch.headers.has('set-cookie'), false);
  const alias = await client.postRaw({
    query:
      'mutation Alias($input: SignInInput!) { login: signIn(input: $input) { user { id } } signOut { success } }',
    variables: { input: { email: fixture.email, password } },
  });
  assert.ok(alias.status >= 400);
  assert.equal(alias.headers.has('set-cookie'), false);
  reportScenario(
    'HTTP-SESSION-00',
    'bearer, password, Origin, batch, and alias rejections cannot issue cookies',
  );
}
