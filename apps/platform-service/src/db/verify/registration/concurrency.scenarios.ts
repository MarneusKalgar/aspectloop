import type { DataSource, QueryRunner } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { EmailVerificationToken } from '#app/auth/registration/model/email-verification-token.entity';
import { AUTH_LOCK_TIMEOUT_MS } from '#app/auth/sessions/session.constants';
import { User } from '#app/users/user.entity';

import { hasAuthErrorCode } from '../auth-sessions/verification-support';
import {
  capturedTokens,
  OwnedRegistrationFixtures,
  type RegistrationClient,
  signupInput,
  type VerificationMail,
} from './verification-support';

interface ObservedOperation {
  error?: unknown;
  succeeded: boolean;
}

/** Proves replacement-versus-consume orderings with real user locks, not scheduler timing guesses. */
export async function verifyReplacementOrderings(
  first: RegistrationClient,
  second: RegistrationClient,
  cleanup: DataSource,
  fixtures: OwnedRegistrationFixtures,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<void> {
  for (const replacementFirst of [true, false]) {
    const fixture = await fixtures.allocate();
    await first.registration.signUp(signupInput(fixture));
    const [rawToken] = await capturedTokens(fixture, 1, first, mail, environment);
    assert.ok(rawToken);
    const parsed = first.tokens.parse(rawToken, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
    assert.ok(parsed);
    const user = await first.dataSource
      .getRepository(User)
      .findOneByOrFail({ email: fixture.email });
    await cleanup.query(
      "UPDATE email_verification_token SET created_at = clock_timestamp() - ($2::double precision * interval '1 millisecond') WHERE user_id = $1",
      [user.id, environment.AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS],
    );
    const blocker = cleanup.createQueryRunner();
    const observed: Promise<ObservedOperation>[] = [];

    try {
      const pid = await holdUserLock(blocker, user.id);
      const deadline = Date.now() + Math.floor(AUTH_LOCK_TIMEOUT_MS / 2);
      const firstOperation = replacementFirst
        ? first.registration.resend({ email: fixture.email })
        : first.registration.confirm({ token: rawToken });
      observed.push(observe(firstOperation));
      const firstPid = await waitForUserLock(first.dataSource, pid, null, deadline);
      const secondOperation = replacementFirst
        ? second.registration.confirm({ token: rawToken })
        : second.registration.resend({ email: fixture.email });
      observed.push(observe(secondOperation));
      await waitForUserLock(first.dataSource, pid, firstPid, deadline);
      await blocker.commitTransaction();
    } finally {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction();
      }

      await blocker.release();
      await Promise.all(observed);
    }

    const [earlier, later] = await Promise.all(observed);
    assert.ok(earlier?.succeeded);
    const token = await first.dataSource
      .getRepository(EmailVerificationToken)
      .findOneByOrFail({ id: parsed.id });

    if (replacementFirst) {
      assert.ok(
        later &&
          !later.succeeded &&
          hasAuthErrorCode(later.error, AUTH_ERROR_CODE.CONFIRMATION_INVALID),
      );
      assert.ok(token.invalidatedAt);
      assert.equal(token.usedAt, null);
      const replacementTokens = await capturedTokens(fixture, 2, first, mail, environment);
      const currentRaw = replacementTokens.find(
        /** Selects only the other owned captured token; no value is exposed in diagnostics. */
        (candidate) => candidate !== rawToken,
      );
      assert.ok(currentRaw);
      await first.registration.confirm({ token: currentRaw });
    } else {
      assert.ok(later?.succeeded);
      assert.ok(token.usedAt);
      assert.equal(token.invalidatedAt, null);
      await capturedTokens(fixture, 1, first, mail, environment);
    }

    const verified = await first.dataSource.getRepository(User).findOneByOrFail({ id: user.id });
    assert.ok(verified.emailVerifiedAt);
  }
}

/** Narrows safe backend identifiers without printing query rows. */
function hasPid(value: unknown): value is [{ pid: number }, ...unknown[]] {
  if (!Array.isArray(value)) {
    return false;
  }

  const firstRow: unknown = value[0];

  return (
    firstRow !== null &&
    typeof firstRow === 'object' &&
    'pid' in firstRow &&
    typeof firstRow.pid === 'number' &&
    Number.isInteger(firstRow.pid)
  );
}

/** Holds the exact owned user row before either production command may make its token decision. */
async function holdUserLock(runner: QueryRunner, userId: string): Promise<number> {
  await runner.connect();
  await runner.startTransaction();
  await runner.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const rows: unknown = await runner.query('SELECT pg_backend_pid() AS pid');
  assert.ok(hasPid(rows));
  return rows[0].pid;
}

/** Attaches rejection handling immediately so race losers cannot become unhandled rejections. */
function observe(operation: Promise<unknown>): Promise<ObservedOperation> {
  return operation.then(
    /** Records success without retaining the generic response. */
    () => ({ succeeded: true }),
    /** Retains failures privately until the exact expected code is asserted. */
    (error: unknown) => ({ error, succeeded: false }),
  );
}

/** Waits for the specific backend lock queue with a bounded deadline and exact blocker identity. */
async function waitForUserLock(
  observer: DataSource,
  blocker: number,
  previous: null | number,
  deadline: number,
): Promise<number> {
  while (Date.now() < deadline) {
    const rows: unknown = await observer.query(
      `SELECT pid FROM pg_stat_activity
       WHERE datname = current_database() AND usename = current_user
         AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'
         AND pid <> COALESCE($2::integer, -1)
         AND ($1::integer = ANY(pg_blocking_pids(pid)) OR $2::integer = ANY(pg_blocking_pids(pid)))`,
      [blocker, previous],
    );

    if (hasPid(rows)) {
      return rows[0].pid;
    }

    /** Polls only the bounded PG lock barrier, not an arbitrary sleep-based race. */
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Registration command did not reach its owned PostgreSQL lock barrier');
}
