import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { assertAuthError, hasAuthErrorCode } from '../auth-sessions/verification-support';
import {
  capturedTokens,
  OwnedRegistrationFixtures,
  type RegistrationClient,
  signupInput,
  type VerificationMail,
} from './verification-support';

/** Proves the live production sign-in path enforces normalized unknown-identity limits and password-success reset. */
export async function verifyIdentityLimits(
  client: RegistrationClient,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<void> {
  const unknown = await fixtures.allocate();
  const checks: Promise<unknown>[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    checks.push(
      client.auth.signInBrowserSession({
        email: ` ${unknown.email.toUpperCase()} `,
        password: unknown.password,
      }),
    );
  }

  const results = await Promise.allSettled(checks);
  let credentialFailures = 0;
  let rateFailures = 0;

  for (const result of results) {
    assert.ok(result.status === 'rejected');

    if (hasAuthErrorCode(result.reason, AUTH_ERROR_CODE.INVALID_CREDENTIALS)) {
      credentialFailures += 1;
    } else {
      assert.ok(hasAuthErrorCode(result.reason, AUTH_ERROR_CODE.RATE_LIMITED));
      rateFailures += 1;
    }
  }

  assert.equal(credentialFailures, 5);
  assert.equal(rateFailures, 1);
  const known = await fixtures.allocate();
  await client.registration.signUp(signupInput(known));
  const [token] = await capturedTokens(known, 1, client, mail, environment);
  assert.ok(token);

  for (let round = 0; round < 2; round += 1) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assertAuthError(
        client.auth.signInBrowserSession({ email: known.email, password: 'wrong-password' }),
        AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    await assertAuthError(
      client.auth.signInBrowserSession({ email: known.email, password: known.password }),
      AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
    );
  }

  await client.registration.confirm({ token });
  const session = await client.auth.signInBrowserSession({
    email: known.email,
    password: known.password,
  });
  await client.sessions.validateBrowserSession(session.sessionCredential, false);
  await client.sessions.signOutBrowserSession(session.sessionCredential);
}
