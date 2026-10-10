import { AUTH_ERROR_CODE, AUTH_ERROR_POLICY } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import type { AuthHttpResult } from './client';

import { AuthHttpClient, readAuthHttpBody } from './client';

export const REGISTRATION_HTTP_OPERATIONS = Object.freeze({
  CONFIRM:
    'mutation Confirm($input: ConfirmEmailInput!) { confirmEmail(input: $input) { success } }',
  ME: 'query Me { me { id } }',
  RESEND:
    'mutation Resend($input: ResendEmailConfirmationInput!) { resendEmailConfirmation(input: $input) { success } }',
  SIGN_IN: 'mutation Login($input: SignInInput!) { signIn(input: $input) { user { id } } }',
  SIGN_OUT: 'mutation Logout { signOut { success } }',
  SIGN_UP:
    'mutation Register($input: SignUpInput!) { signUp(input: $input) { success user { id email } } }',
});

export const REGISTRATION_HTTP_STAGE = Object.freeze({
  CAPTURE: 'capture-prerequisite',
  CLEANUP: 'cleanup',
  CONFIRMATION: 'confirmation',
  DUPLICATE: 'duplicate-signup',
  LIMITS: 'limits',
  MAIL: 'mail-capture',
  REJECTIONS: 'rejections',
  REPLACEMENT: 'replacement',
  SESSION: 'original-session',
  SIGN_UP: 'signup',
  SIGN_UP_STATE: 'signup-state',
  UNKNOWN_VERIFIED: 'unknown-verified',
  UNVERIFIED_LOGIN: 'unverified-signin',
  VERIFIED_LOGIN: 'verified-signin',
} as const);

export type RegistrationHttpStage =
  (typeof REGISTRATION_HTTP_STAGE)[keyof typeof REGISTRATION_HTTP_STAGE];

/** Applies every registration result/error to a live cookie and revalidates the independent session. */
export class RegistrationHttpObserver {
  /** Keeps the existing session separate from newly registered account credentials. */
  constructor(
    readonly client: AuthHttpClient,
    private readonly originalUserId: string,
  ) {}

  /** Revalidates the original server session independently of unrelated login/logout cookie writes. */
  async assertCurrentSession(): Promise<void> {
    const me = await this.client.graphql(REGISTRATION_HTTP_OPERATIONS.ME);
    assert.equal(me.errors, undefined);
    assert.equal(publicRecord(me, 'me').id, this.originalUserId);
    assert.equal(me.response.headers.has('set-cookie'), false);
  }

  /** Checks public/private structural, dependency and pre-execution rejections without leaking bodies. */
  async assertPreserved(response: Response): Promise<void> {
    assert.equal(response.headers.has('set-cookie'), false);
    await this.assertCurrentSession();
  }

  /** Asserts cookie neutrality and original server-side authority after each public registration attempt. */
  async request(query: string, input: Record<string, unknown>): Promise<AuthHttpResult> {
    const result = await this.client.graphql(query, { input });
    assert.match(
      result.response.headers.get('cache-control') ?? '',
      /(?:^|,)\s*no-store(?:\s*,|$)/,
    );
    await this.assertPreserved(result.response);
    return result;
  }
}

/** Accepts only a generic root result, including the explicitly null deprecated signup user. */
export function assertGenericRegistration(result: AuthHttpResult, root: string): void {
  assert.equal(result.errors, undefined);
  assert.deepEqual(
    publicRecord(result, root),
    root === 'signUp' ? { success: true, user: null } : { success: true },
  );
}

/** Requires an errors-only pre-execution envelope; HTTP 200 alone does not mean GraphQL success. */
export async function assertPreExecutionGraphqlRejection(response: Response): Promise<void> {
  assert.ok(response.status === 200 || response.status === 400);
  assert.equal(response.headers.has('set-cookie'), false);

  const body = await readAuthHttpBody(response);
  assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body));
  assert.equal(Object.hasOwn(body, 'data'), false);
  assert.ok('errors' in body && Array.isArray(body.errors) && body.errors.length === 1);

  const error: unknown = body.errors[0];
  assert.ok(error !== null && typeof error === 'object' && !Array.isArray(error));
  assert.ok('message' in error && typeof error.message === 'string' && error.message.length > 0);
  assert.equal(Object.hasOwn(error, 'path'), false);
}

/** Requires one stable auth rejection without depending on upstream message text. */
export function assertPublicAuthError(result: AuthHttpResult, code: string): void {
  assert.equal(result.errors?.[0]?.extensions?.code, code);
  assert.equal(result.response.headers.has('set-cookie'), false);

  if (code === AUTH_ERROR_CODE.RATE_LIMITED) {
    const retry = result.errors?.[0]?.extensions?.retryAfterMs;
    assert.ok(
      typeof retry === 'number' &&
        Number.isInteger(retry) &&
        retry >= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN &&
        retry <= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX,
    );
  }
}

/** Narrows only a public projection; private token/password values are never included in diagnostics. */
export function publicRecord(result: AuthHttpResult, root: string): Record<string, unknown> {
  const value = result.data?.[root];
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

/** Emits only an allowlisted verifier stage, never an assertion, response, credential or provider diagnostic. */
export function reportRegistrationHttpFailure(stage: RegistrationHttpStage): void {
  const safeStage = Object.values(REGISTRATION_HTTP_STAGE).includes(stage) ? stage : 'unknown';
  console.error(`D3-EMAIL-${safeStage} failed; private details omitted.`);
}
