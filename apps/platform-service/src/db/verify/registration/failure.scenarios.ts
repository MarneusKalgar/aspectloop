import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { QueryFailedError } from 'typeorm';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { PasswordService } from '#app/auth/credentials/password.service';
import { AuthIdentityLimiter } from '#app/auth/limits/auth-identity-limiter';
import { EmailVerificationToken } from '#app/auth/registration/model/email-verification-token.entity';
import { RegistrationService } from '#app/auth/registration/registration.service';
import { MAIL_ADMISSION, MAIL_OUTCOME, type MailDispatcher } from '#app/mail/mail.port';
import { User } from '#app/users/user.entity';

import {
  assertAuthError,
  assertCompletesWithin,
  AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
  FaultInjectingOpaqueTokenService,
} from '../auth-sessions/verification-support';
import {
  capturedTokens,
  OwnedRegistrationFixtures,
  type RegistrationClient,
  signupInput,
  type VerificationMail,
} from './verification-support';

/** Proves terminal issuance history survives replacement, new limiter instances and failed delivery. */
export async function verifyDurableCooldownAndMailFailure(
  first: RegistrationClient,
  cleanup: DataSource,
  fixtures: OwnedRegistrationFixtures,
  environment: EnvironmentVariables,
): Promise<void> {
  for (const admission of [
    MAIL_ADMISSION.QUEUE_FULL,
    MAIL_ADMISSION.STOPPED,
    MAIL_ADMISSION.QUEUED,
  ]) {
    const fixture = await fixtures.allocate();
    let submitted = 0;
    const failedMail: MailDispatcher = {
      /** Supplies a fixed D1 failure receipt; the real PostgreSQL commit must remain durable. */
      enqueue: () => {
        submitted += 1;
        return { admission, completion: Promise.resolve(MAIL_OUTCOME.SMTP_FAILED) };
      },
    };
    const config = new ConfigService(environment);
    const service = new RegistrationService(
      first.store,
      new PasswordService(config),
      new AuthIdentityLimiter(),
      config,
      failedMail,
    );
    assert.deepEqual(await service.signUp(signupInput(fixture)), { success: true });
    const user = await cleanup.getRepository(User).findOneByOrFail({ email: fixture.email });
    const repository = first.dataSource.getRepository(EmailVerificationToken);
    const before = await repository.findBy({ userId: user.id });
    assert.equal(before.length, 1);
    assert.equal(submitted, 1);
    await cleanup.query(
      'UPDATE email_verification_token SET invalidated_at = clock_timestamp() WHERE user_id = $1',
      [user.id],
    );
    const restarted = new RegistrationService(
      first.store,
      new PasswordService(config),
      new AuthIdentityLimiter(),
      config,
      failedMail,
    );
    await restarted.resend({ email: fixture.email });
    assert.equal(await repository.countBy({ userId: user.id }), 1);
    assert.equal(submitted, 1);
    await cleanup.query(
      "UPDATE email_verification_token SET created_at = clock_timestamp() - ($2::double precision * interval '1 millisecond') WHERE user_id = $1",
      [user.id, environment.AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS],
    );
    await restarted.resend({ email: fixture.email });
    assert.equal(await repository.countBy({ userId: user.id }), 2);
    assert.equal(submitted, 2);
  }
}

/** Proves an ambiguous post-commit response and bad capture result still clean only their pre-owned fixtures. */
export async function verifyOwnedFailureCleanup(
  first: RegistrationClient,
  cleanup: DataSource,
  mail: VerificationMail,
  environment: EnvironmentVariables,
  originalSession: string,
): Promise<void> {
  const owned = new OwnedRegistrationFixtures(cleanup);
  let responseFailureEmail: string;
  let captureFailureEmail: string;
  const config = new ConfigService(environment);
  const throwingMail: MailDispatcher = {
    /** Injects one post-commit port failure; raw diagnostics are caught and never printed. */
    enqueue: () => {
      throw new Error('Injected private post-commit failure');
    },
  };
  const service = new RegistrationService(
    first.store,
    new PasswordService(config),
    new AuthIdentityLimiter(),
    config,
    throwingMail,
  );

  try {
    const responseFailure = await owned.allocate();
    const captureFailure = await owned.allocate();
    responseFailureEmail = responseFailure.email;
    captureFailureEmail = captureFailure.email;
    await assert.rejects(service.signUp(signupInput(responseFailure)));
    assert.equal(
      await first.dataSource.getRepository(User).countBy({ email: responseFailure.email }),
      1,
    );
    await first.registration.signUp(signupInput(captureFailure));
    await mail.drain();
    await assert.rejects(
      captureFailure.capture.readConfirmationTokens(
        1,
        'intentionally-wrong@example.test',
        environment.WEB_PUBLIC_BASE_URL,
        first.tokens,
      ),
    );
  } finally {
    try {
      await mail.drain();
    } finally {
      await owned.cleanup();
    }
  }

  assert.ok(responseFailureEmail && captureFailureEmail);
  assert.equal(
    await first.dataSource.getRepository(User).countBy({ email: responseFailureEmail }),
    0,
  );
  assert.equal(
    await first.dataSource.getRepository(User).countBy({ email: captureFailureEmail }),
    0,
  );
  await first.sessions.validateBrowserSession(originalSession, false);
}

/** Proves a held real user lock fails with the established dependency classification and bounded wait. */
export async function verifyRegistrationLockWait(
  first: RegistrationClient,
  cleanup: DataSource,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<void> {
  const fixture = await fixtures.allocate();
  await first.registration.signUp(signupInput(fixture));
  await capturedTokens(fixture, 1, first, mail, environment);
  const user = await first.dataSource.getRepository(User).findOneByOrFail({ email: fixture.email });
  const blocker = cleanup.createQueryRunner();

  try {
    await blocker.connect();
    await blocker.startTransaction();
    await blocker.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    await assertCompletesWithin(
      assertAuthError(first.store.resend(fixture.email), AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE),
      AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
    );
  } finally {
    if (blocker.isTransactionActive) {
      await blocker.rollbackTransaction();
    }

    await blocker.release();
  }
}

/** Proves uniqueness failure rolls back account creation and wrong-purpose digests cannot confirm. */
export async function verifyRegistrationRollback(
  first: RegistrationClient,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
  faultTokens: FaultInjectingOpaqueTokenService,
): Promise<void> {
  const existing = await fixtures.allocate();
  await first.registration.signUp(signupInput(existing));
  const [raw] = await capturedTokens(existing, 1, first, mail, environment);
  assert.ok(raw);
  const parsed = first.tokens.parse(raw, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  assert.ok(parsed);
  const collision = await fixtures.allocate();
  faultTokens.failNextIssueWith({ ...parsed, rawToken: raw });
  await assert.rejects(
    first.registration.signUp(signupInput(collision)),
    /** Integrity defects remain unexpected, not falsely mapped to a dependency outage. */
    (error: unknown) => error instanceof QueryFailedError,
  );
  assert.equal(await first.dataSource.getRepository(User).countBy({ email: collision.email }), 0);
  await mail.drain();
  await collision.capture.assertEmpty();

  const wrongPurpose = await fixtures.allocate();
  const issued = first.tokens.issue(OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);
  faultTokens.failNextIssueWith(issued);
  await first.registration.signUp(signupInput(wrongPurpose));
  const [captured] = await capturedTokens(wrongPurpose, 1, first, mail, environment);
  assert.equal(captured, issued.rawToken);
  await assertAuthError(
    first.registration.confirm({ token: issued.rawToken }),
    AUTH_ERROR_CODE.CONFIRMATION_INVALID,
  );
}
