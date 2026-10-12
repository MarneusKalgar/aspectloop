import type { DataSource } from 'typeorm';

import {
  AUTH_ERROR_CODE,
  PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH,
} from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import { IDENTITY_LIMITS } from '#app/auth/limits/identity-limit.constants';

import { readAuthHttpBody } from './client';
import {
  assertGenericRegistration,
  assertPreExecutionGraphqlRejection,
  assertPublicAuthError,
  REGISTRATION_HTTP_OPERATIONS as OP,
  type RegistrationHttpObserver,
} from './registration-http.support';

// Expected public IP ceilings are verifier evidence, not imports of another application's internals.
const HTTP_VERIFICATION_LIMITS = Object.freeze({
  CONFIRMATION_IP_PROBES: 11,
  DEPENDENCY_COMPLETION_MS: 10_000,
  REGISTRATION_IP_PROBES: 21,
});

/** Runs threshold checks last; deliberate IP exhaustion cannot poison earlier aggregate groups. */
export async function verifyRegistrationHttpLimits(
  observer: RegistrationHttpObserver,
  unknownEmail: string,
): Promise<void> {
  for (let attempt = 0; attempt < IDENTITY_LIMITS.SIGN_IN_ATTEMPTS; attempt += 1) {
    const result = await observer.client.graphql(OP.SIGN_IN, {
      input: { email: unknownEmail, password: 'wrong-password' },
    });
    assertPublicAuthError(result, AUTH_ERROR_CODE.INVALID_CREDENTIALS);
    await observer.assertPreserved(result.response);
  }
  const limited = await observer.client.graphql(OP.SIGN_IN, {
    input: { email: unknownEmail, password: 'wrong-password' },
  });
  assertPublicAuthError(limited, AUTH_ERROR_CODE.RATE_LIMITED);
  await observer.assertPreserved(limited.response);

  let registrationLimited = false;
  for (let attempt = 0; attempt < HTTP_VERIFICATION_LIMITS.REGISTRATION_IP_PROBES; attempt += 1) {
    const result = await observer.request(OP.RESEND, { email: unknownEmail });
    if (result.errors?.[0]?.extensions?.code === AUTH_ERROR_CODE.RATE_LIMITED) {
      assertPublicAuthError(result, AUTH_ERROR_CODE.RATE_LIMITED);
      registrationLimited = true;
      break;
    }
    assertGenericRegistration(result, 'resendEmailConfirmation');
  }
  assert.equal(registrationLimited, true);

  let confirmationLimited = false;
  for (let attempt = 0; attempt < HTTP_VERIFICATION_LIMITS.CONFIRMATION_IP_PROBES; attempt += 1) {
    const result = await observer.request(OP.CONFIRM, { token: 'malformed' });
    if (result.errors?.[0]?.extensions?.code === AUTH_ERROR_CODE.RATE_LIMITED) {
      assertPublicAuthError(result, AUTH_ERROR_CODE.RATE_LIMITED);
      confirmationLimited = true;
      break;
    }
    assertPublicAuthError(result, AUTH_ERROR_CODE.CONFIRMATION_INVALID);
  }
  assert.equal(confirmationLimited, true);
}

/** Exercises public/private malformed requests and a real lock outage without changing production policy. */
export async function verifyRegistrationHttpRejections(
  cleanup: DataSource,
  observer: RegistrationHttpObserver,
  ownedUserId: string,
  consumedToken: string,
): Promise<void> {
  for (const token of [
    '',
    'x'.repeat(PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH + 1),
    'malformed',
  ]) {
    assertPublicAuthError(
      await observer.request(OP.CONFIRM, { token }),
      AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    );
    const response = await observer.client.requestPrivateRegistration('confirmEmail', { token });
    assert.equal(response.status, 400);
    const body = await readAuthHttpBody(response);
    assert.ok(body !== null && typeof body === 'object' && 'code' in body);
    assert.equal(body.code, AUTH_ERROR_CODE.CONFIRMATION_INVALID);
    await observer.assertPreserved(response);
  }

  const malformed = await observer.client.requestPrivateRegistration('confirmEmail', { token: 42 });
  assert.equal(malformed.status, 400);
  await malformed.body?.cancel();
  await observer.assertPreserved(malformed);
  const badShape = await observer.request(OP.SIGN_UP, {
    displayName: 'Rejected',
    email: '',
    password: 'valid-password',
  });
  assertPublicAuthError(badShape, 'BAD_REQUEST');
  const shape = await observer.client.postRaw({
    query: OP.CONFIRM,
    variables: { input: { token: 'malformed', unexpected: true } },
  });
  await assertPreExecutionGraphqlRejection(shape);
  await observer.assertPreserved(shape);
  const denied = await observer.client.requestDeniedOrigin(OP.RESEND, {
    input: { email: 'unused@example.test' },
  });
  assert.ok(denied.status >= 400);
  await denied.body?.cancel();
  await observer.assertPreserved(denied);
  const batch = await observer.client.postRaw([
    { query: OP.RESEND, variables: { input: { email: 'unused@example.test' } } },
  ]);
  assert.ok(batch.status >= 400);
  await batch.body?.cancel();
  await observer.assertPreserved(batch);

  const blocker = cleanup.createQueryRunner();
  try {
    await blocker.connect();
    await blocker.startTransaction();
    await blocker.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [ownedUserId]);
    // Discovery finds the owned consumed token; its user lock must time out before terminal rejection.
    const started = performance.now();
    assertPublicAuthError(
      await observer.request(OP.CONFIRM, { token: consumedToken }),
      AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
    );
    assert.ok(performance.now() - started < HTTP_VERIFICATION_LIMITS.DEPENDENCY_COMPLETION_MS);
  } finally {
    try {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction();
      }
    } finally {
      await blocker.release();
    }
  }
}
