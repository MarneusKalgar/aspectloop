import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';
import { DataSource, In, IsNull, QueryFailedError } from 'typeorm';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { PlatformAuthException } from '#app/auth/platform-auth.exception';
import { AuthRefreshToken } from '#app/auth/sessions/model/auth-refresh-token.entity';
import { AuthSession } from '#app/auth/sessions/model/auth-session.entity';
import { User } from '#app/users/user.entity';

import type { FaultInjectingOpaqueTokenService, VerificationClient } from './verification-support';

import {
  assertAuthError,
  assertCompletesWithin,
  AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
  AUTH_LOCK_VERIFY_MIN_ELAPSED_MS,
  hasAuthErrorCode,
} from './verification-support';

/** Proves an occupied user lock fails within the configured bounded wait. */
export async function verifyBoundedLockWait(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const queryRunner = cleanup.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const startedAt = Date.now();
    await assertCompletesWithin(
      assertAuthError(client.store.create(userId), AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE),
      AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
    );
    const elapsedMs = Date.now() - startedAt;

    assert.ok(
      elapsedMs >= AUTH_LOCK_VERIFY_MIN_ELAPSED_MS,
      `Lock wait failed too early after ${elapsedMs}ms`,
    );
    assert.ok(
      elapsedMs <= AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
      `Lock wait exceeded its verification bound after ${elapsedMs}ms`,
    );
  } finally {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  }
}

/** Proves deleting the authoritative user cascades its families and fails refresh closed. */
export async function verifyDeletedUser(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const issued = await client.store.create(userId);
  const browserSession = await client.store.createBrowserSession(userId);
  const sessionIds = (
    await cleanup.getRepository(AuthSession).find({ select: { id: true }, where: { userId } })
  ).map((session) => session.id);

  assert.ok(sessionIds.includes(issued.sessionId));
  assert.ok(sessionIds.includes(browserSession.sessionId));
  await cleanup.getRepository(User).delete({ id: userId });
  assert.equal(await cleanup.getRepository(AuthSession).countBy({ userId }), 0);
  assert.equal(
    await cleanup.getRepository(AuthRefreshToken).countBy({ sessionId: In(sessionIds) }),
    0,
  );
  await assertAuthError(client.store.refresh(issued.refreshToken), AUTH_ERROR_CODE.SESSION_INVALID);
  await assertAuthError(
    client.store.validateBrowserSession(browserSession.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
}

/** Proves both persisted inactivity and absolute boundaries fail closed. */
export async function verifyExpiryBoundaries(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  for (const boundary of ['inactivity', 'absolute'] as const) {
    const issued = await client.store.create(userId);
    await cleanup.query(
      `UPDATE auth_session
       SET inactivity_expires_at = expired.at,
           absolute_expires_at = CASE WHEN $1 = 'absolute' THEN expired.at ELSE absolute_expires_at END
       FROM (SELECT clock_timestamp() AS at) expired
       WHERE id = $2`,
      [boundary, issued.sessionId],
    );
    await assertAuthError(
      client.store.refresh(issued.refreshToken),
      AUTH_ERROR_CODE.SESSION_INVALID,
    );
  }
}

/** Proves multiple logins create independently rotating families for one user. */
export async function verifyIndependentFamilies(
  first: VerificationClient,
  second: VerificationClient,
  userId: string,
): Promise<void> {
  const left = await first.store.create(userId);
  const right = await second.store.create(userId);

  assert.notEqual(left.sessionId, right.sessionId);
  await Promise.all([
    first.store.refresh(left.refreshToken),
    second.store.refresh(right.refreshToken),
  ]);
}

/** Proves only digests persist and configured absolute/idle clocks bound a new family. */
export async function verifyIssuancePersistence(
  client: VerificationClient,
  environment: EnvironmentVariables,
  userId: string,
): Promise<void> {
  const issued = await client.store.create(userId);
  const parsedId = issued.refreshToken.slice(0, issued.refreshToken.indexOf('.'));
  const token = await client.dataSource
    .getRepository(AuthRefreshToken)
    .findOneByOrFail({ id: parsedId });
  const session = await client.dataSource
    .getRepository(AuthSession)
    .findOneByOrFail({ id: issued.sessionId });

  assert.equal(token.tokenDigest.length, 64);
  assert.equal(token.tokenDigest.includes(issued.refreshToken), false);
  assert.equal(token.expiresAt.getTime(), session.inactivityExpiresAt.getTime());
  assert.equal(
    session.absoluteExpiresAt.getTime() - issued.issuedAt.getTime(),
    environment.AUTH_SESSION_ABSOLUTE_TTL_MS,
  );
  assert.equal(
    session.inactivityExpiresAt.getTime() - issued.issuedAt.getTime(),
    environment.AUTH_SESSION_IDLE_TTL_MS,
  );
}

/** Proves current and historical secrets revoke a family while invalid logout stays idempotent. */
export async function verifyLogoutSemantics(
  first: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const currentFamily = await first.store.create(userId);
  await first.store.signOut(currentFamily.refreshToken);
  await assertAuthError(
    first.store.refresh(currentFamily.refreshToken),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const historicalFamily = await first.store.create(userId);
  const successor = await first.store.refresh(historicalFamily.refreshToken);
  const historicalId = historicalFamily.refreshToken.slice(
    0,
    historicalFamily.refreshToken.indexOf('.'),
  );
  await cleanup.query(
    "UPDATE auth_refresh_token SET expires_at = created_at + interval '1 millisecond' WHERE id = $1",
    [historicalId],
  );
  await first.store.signOut(historicalFamily.refreshToken);
  await assertAuthError(
    first.store.refresh(successor.refreshToken),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const invalidSecretFamily = await first.store.create(userId);
  const separatorIndex = invalidSecretFamily.refreshToken.indexOf('.');
  const secret = invalidSecretFamily.refreshToken.slice(separatorIndex + 1);
  const alteredSecret = `${invalidSecretFamily.refreshToken.slice(0, separatorIndex + 1)}${
    secret.startsWith('A') ? 'B' : 'A'
  }${secret.slice(1)}`;
  await first.store.signOut(alteredSecret);
  await first.store.refresh(invalidSecretFamily.refreshToken);

  await first.store.signOut('missing-or-malformed');
}

/** Proves refresh/logout serialization revokes one family without touching a peer family. */
export async function verifyRefreshLogoutRace(
  first: VerificationClient,
  second: VerificationClient,
  userId: string,
): Promise<void> {
  const raced = await first.store.create(userId);
  const independent = await second.store.create(userId);
  const [refreshResult, logoutResult] = await Promise.allSettled([
    first.store.refresh(raced.refreshToken),
    second.store.signOut(raced.refreshToken),
  ]);

  assert.equal(logoutResult.status, 'fulfilled');

  if (refreshResult.status === 'fulfilled') {
    await assertAuthError(
      first.store.refresh(refreshResult.value.refreshToken),
      AUTH_ERROR_CODE.SESSION_INVALID,
    );
  } else {
    assert.equal(hasAuthErrorCode(refreshResult.reason, AUTH_ERROR_CODE.SESSION_INVALID), true);
  }

  await assertAuthError(
    first.store.getActiveUser(userId, raced.sessionId),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await second.store.refresh(independent.refreshToken);
}

/** Proves one concurrent rotation wins and predecessor reuse revokes its whole family. */
export async function verifyRotationAndReplay(
  first: VerificationClient,
  second: VerificationClient,
  cleanup: DataSource,
  userId: string,
  environment: EnvironmentVariables,
): Promise<void> {
  const original = await first.store.create(userId);
  const results = await Promise.allSettled([
    first.store.refresh(original.refreshToken),
    second.store.refresh(original.refreshToken),
  ]);
  const winners = results.filter((result) => result.status === 'fulfilled');
  const conflicts = results.filter(
    (result) =>
      result.status === 'rejected' &&
      result.reason instanceof PlatformAuthException &&
      (result.reason.getResponse() as { code?: unknown }).code === AUTH_ERROR_CODE.REFRESH_CONFLICT,
  );

  assert.equal(winners.length, 1, 'Expected exactly one refresh-rotation winner');
  assert.equal(conflicts.length, 1, 'Expected exactly one refresh conflict within grace');
  assert.equal(
    await first.dataSource.getRepository(AuthRefreshToken).count({
      where: { revokedAt: IsNull(), rotatedAt: IsNull(), sessionId: original.sessionId },
    }),
    1,
    'Expected exactly one current token after concurrent rotation',
  );

  const successor = winners[0];
  assert.equal(successor?.status, 'fulfilled');

  if (successor?.status !== 'fulfilled') {
    throw new Error('Refresh successor was unavailable');
  }

  const predecessorId = original.refreshToken.slice(0, original.refreshToken.indexOf('.'));
  const successorId = successor.value.refreshToken.slice(
    0,
    successor.value.refreshToken.indexOf('.'),
  );
  const predecessor = await first.dataSource
    .getRepository(AuthRefreshToken)
    .findOneByOrFail({ id: predecessorId });
  const successorRow = await first.dataSource
    .getRepository(AuthRefreshToken)
    .findOneByOrFail({ id: successorId });
  assert.equal(predecessor.replacementTokenId, successorId);
  assert.equal(successorRow.sessionId, predecessor.sessionId);

  await cleanup.query(
    `UPDATE auth_refresh_token
     SET expires_at = created_at + interval '1 millisecond',
         rotated_at = clock_timestamp() - ($1::int * interval '1 millisecond')
     WHERE id = $2`,
    [environment.AUTH_REFRESH_GRACE_MS + 1, predecessorId],
  );

  await assertAuthError(
    first.store.refresh(original.refreshToken),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await assertAuthError(
    second.store.refresh(successor.value.refreshToken),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const family = await first.dataSource
    .getRepository(AuthSession)
    .findOneByOrFail({ id: original.sessionId });
  assert.notEqual(family.revokedAt, null);
  assert.equal(family.revocationReason, 'refresh_reuse');
}

/** Proves an integrity failure rolls every earlier rotation mutation back without remapping it. */
export async function verifyRotationRollback(
  client: VerificationClient,
  faultInjectingTokens: FaultInjectingOpaqueTokenService,
  userId: string,
): Promise<void> {
  const issued = await client.store.create(userId);
  const parsed = faultInjectingTokens.parse(issued.refreshToken, OPAQUE_TOKEN_PURPOSE.REFRESH);

  assert.notEqual(parsed, null);

  if (!parsed) {
    throw new Error('Rollback fixture token could not be parsed');
  }

  const tokenRepository = client.dataSource.getRepository(AuthRefreshToken);
  const sessionRepository = client.dataSource.getRepository(AuthSession);
  const predecessorBefore = await tokenRepository.findOneByOrFail({ id: parsed.id });
  const sessionBefore = await sessionRepository.findOneByOrFail({ id: issued.sessionId });
  const lastRefreshedBefore = sessionBefore.lastRefreshedAt.getTime();
  const inactivityExpiryBefore = sessionBefore.inactivityExpiresAt.getTime();

  faultInjectingTokens.failNextIssueWith({
    digest: parsed.digest,
    id: parsed.id,
    rawToken: issued.refreshToken,
  });
  await assert.rejects(
    client.store.refresh(issued.refreshToken),
    (error: unknown) => error instanceof QueryFailedError,
  );

  const predecessorAfter = await tokenRepository.findOneByOrFail({ id: parsed.id });
  const sessionAfter = await sessionRepository.findOneByOrFail({ id: issued.sessionId });

  assert.equal(predecessorBefore.rotatedAt, null);
  assert.equal(predecessorAfter.rotatedAt, null);
  assert.equal(predecessorAfter.replacementTokenId, null);
  assert.equal(await tokenRepository.countBy({ sessionId: issued.sessionId }), 1);
  assert.equal(sessionAfter.lastRefreshedAt.getTime(), lastRefreshedBefore);
  assert.equal(sessionAfter.inactivityExpiresAt.getTime(), inactivityExpiryBefore);
  await client.store.refresh(issued.refreshToken);
}
