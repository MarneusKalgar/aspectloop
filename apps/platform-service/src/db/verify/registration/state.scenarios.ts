import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { EmailVerificationToken } from '#app/auth/registration/model/email-verification-token.entity';
import { User } from '#app/users/user.entity';

import { assertAuthError, hasAuthErrorCode } from '../auth-sessions/verification-support';
import {
  capturedTokens,
  OwnedRegistrationFixtures,
  type RegistrationClient,
  signupInput,
  type VerificationMail,
} from './verification-support';

/** Proves bad-secret/purpose/shape/terminal/deleted-user candidates share the same confirmation error. */
export async function verifyConfirmationRejections(
  first: RegistrationClient,
  second: RegistrationClient,
  cleanup: DataSource,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<void> {
  const fixture = await fixtures.allocate();
  await first.registration.signUp(signupInput(fixture));
  const [raw] = await capturedTokens(fixture, 1, first, mail, environment);
  assert.ok(raw);
  const parsed = first.tokens.parse(raw, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  assert.ok(parsed);
  const wrongSecret = `${parsed.id}.${raw.endsWith('A') ? 'B' : 'A'}${raw.slice(parsed.id.length + 2)}`;
  const wrongPurpose = first.tokens.issue(OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);

  for (const token of ['', 'x'.repeat(129), 'malformed', wrongSecret, wrongPurpose.rawToken]) {
    await assertAuthError(
      first.registration.confirm({ token }),
      AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    );
  }

  const consumes = await Promise.allSettled([
    first.registration.confirm({ token: raw }),
    second.registration.confirm({ token: raw }),
  ]);
  assert.equal(
    consumes.filter(
      /** Counts only successful command completion, without leaking rejection details. */
      (result) => result.status === 'fulfilled',
    ).length,
    1,
  );
  const rejection = consumes.find(
    /** Identifies the competing invalid-token rejection after the first consumption committed. */
    (result) => result.status === 'rejected',
  );
  assert.ok(
    rejection?.status === 'rejected' &&
      hasAuthErrorCode(rejection.reason, AUTH_ERROR_CODE.CONFIRMATION_INVALID),
  );
  await assertAuthError(
    first.registration.confirm({ token: raw }),
    AUTH_ERROR_CODE.CONFIRMATION_INVALID,
  );
  const deleted = await fixtures.allocate();
  await first.registration.signUp(signupInput(deleted));
  const [deletedRaw] = await capturedTokens(deleted, 1, first, mail, environment);
  assert.ok(deletedRaw);
  const user = await cleanup.getRepository(User).findOneByOrFail({ email: deleted.email });
  await cleanup.getRepository(User).delete({ email: deleted.email, id: user.id });
  await assertAuthError(
    first.registration.confirm({ token: deletedRaw }),
    AUTH_ERROR_CODE.CONFIRMATION_INVALID,
  );
}

/** Proves concurrent creation preserves one user/token, duplicate profile bytes and generic suppression. */
export async function verifyRegistrationCreation(
  first: RegistrationClient,
  second: RegistrationClient,
  cleanup: DataSource,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<string> {
  const fixture = await fixtures.allocate();
  const input = signupInput(fixture);
  const results = await Promise.all([
    first.registration.signUp(input),
    second.registration.signUp(input),
  ]);
  assert.deepEqual(results, [{ success: true }, { success: true }]);
  const users = first.dataSource.getRepository(User);
  const user = await users
    .createQueryBuilder('user')
    .addSelect('user.passwordHash')
    .where('user.email = :email', { email: fixture.email })
    .getOneOrFail();
  assert.equal(await users.countBy({ email: fixture.email }), 1);
  assert.equal(user.emailVerifiedAt, null);
  const tokenRepository = first.dataSource.getRepository(EmailVerificationToken);
  const tokens = await tokenRepository.findBy({ userId: user.id });
  assert.equal(tokens.length, 1);
  const [rawToken] = await capturedTokens(fixture, 1, first, mail, environment);
  assert.ok(rawToken);
  const parsed = first.tokens.parse(rawToken, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  assert.ok(parsed);
  assert.equal(tokens[0]?.id, parsed.id);
  assert.equal(tokens[0]?.tokenDigest, parsed.digest);
  assert.equal(
    await first.dataSource
      .query('SELECT count(*)::integer AS count FROM auth_session WHERE user_id = $1', [user.id])
      .then(
        /** Reads only a safe aggregate; never selects credentials from session state. */
        (rows: unknown) => countFromRows(rows),
      ),
    0,
  );
  assert.ok(
    tokens[0] &&
      Math.abs(
        tokens[0].expiresAt.getTime() -
          tokens[0].createdAt.getTime() -
          environment.AUTH_EMAIL_CONFIRMATION_TTL_MS,
      ) <= 1,
  );
  await assertAuthError(
    first.auth.signInBrowserSession({ email: fixture.email, password: fixture.password }),
    AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
  );
  await first.registration.signUp({
    ...input,
    displayName: 'Must not replace',
    password: 'different-password',
  });
  const after = await users
    .createQueryBuilder('user')
    .addSelect('user.passwordHash')
    .where('user.id = :id', { id: user.id })
    .getOneOrFail();
  assert.deepEqual(after, user);
  assert.equal(await tokenRepository.countBy({ userId: user.id }), 1);
  await first.registration.resend({ email: fixture.email });
  await first.registration.resend({ email: fixture.email });
  assert.equal(await tokenRepository.countBy({ userId: user.id }), 1);
  const unknown = await fixtures.allocate();
  await first.registration.resend({ email: unknown.email });
  assert.equal(await users.countBy({ email: unknown.email }), 0);
  await first.registration.confirm({ token: rawToken });
  const session = await first.auth.signInBrowserSession({
    email: fixture.email,
    password: fixture.password,
  });
  await second.registration.resend({ email: fixture.email });
  await second.registration.signUp({ ...input, displayName: 'Verified overwrite forbidden' });
  await first.sessions.validateBrowserSession(session.sessionCredential, false);
  assert.equal(await tokenRepository.countBy({ userId: user.id }), 1);
  const expired = await fixtures.allocate();
  await first.registration.signUp(signupInput(expired));
  const [expiredRaw] = await capturedTokens(expired, 1, first, mail, environment);
  assert.ok(expiredRaw);
  const expiredParsed = first.tokens.parse(expiredRaw, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  assert.ok(expiredParsed);
  await cleanup.query(
    "UPDATE email_verification_token SET created_at = clock_timestamp() - interval '2 days', expires_at = clock_timestamp() WHERE id = $1",
    [expiredParsed.id],
  );
  await assertAuthError(
    first.registration.confirm({ token: expiredRaw }),
    AUTH_ERROR_CODE.CONFIRMATION_INVALID,
  );
  await first.registration.resend({ email: expired.email });
  const replacement = await tokenRepository.findOneByOrFail({ id: expiredParsed.id });
  assert.ok(replacement.invalidatedAt);
  await mail.drain();
  return session.sessionCredential;
}

/** Rejects malformed aggregate responses without retaining row contents in diagnostics. */
function countFromRows(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Invalid verification aggregate');
  }

  const firstRow: unknown = rows[0];

  if (
    firstRow === null ||
    typeof firstRow !== 'object' ||
    !('count' in firstRow) ||
    typeof firstRow.count !== 'number'
  ) {
    throw new Error('Invalid verification aggregate');
  }

  return firstRow.count;
}
