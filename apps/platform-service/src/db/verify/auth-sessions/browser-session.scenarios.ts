import type { DataSource } from 'typeorm';

import {
  AUTH_ERROR_CODE,
  PLATFORM_AUTH_ROLES,
  PLATFORM_AUTH_SCOPES,
} from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { AuthRefreshToken } from '#app/auth/sessions/model/auth-refresh-token.entity';
import { AuthSession } from '#app/auth/sessions/model/auth-session.entity';
import { AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS } from '#app/auth/sessions/session.constants';
import { User } from '#app/users/user.entity';

import type { VerificationClient } from './verification-support';

import {
  assertAuthError,
  assertCompletesWithin,
  AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
  insertVerifiedUser,
  readVerificationDatabaseNow,
} from './verification-support';

/** Proves activity is optional, throttled, absolute-capped, and unable to revive terminal rows. */
export async function verifyBrowserSessionActivity(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const issued = await client.store.createBrowserSession(userId);
  const initial = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: issued.sessionId });

  await client.store.validateBrowserSession(issued.sessionCredential, false);
  const untouched = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: issued.sessionId });
  assert.equal(untouched.lastActivityAt?.getTime(), initial.lastActivityAt?.getTime());

  await ageBrowserSessionActivity(cleanup, issued.sessionId);
  const stale = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: issued.sessionId });
  await client.store.validateBrowserSession(issued.sessionCredential, true);
  const touched = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: issued.sessionId });
  assert.ok((touched.lastActivityAt?.getTime() ?? 0) > (stale.lastActivityAt?.getTime() ?? 0));
  assert.ok(touched.inactivityExpiresAt.getTime() <= touched.absoluteExpiresAt.getTime());

  await client.store.validateBrowserSession(issued.sessionCredential, true);
  const throttled = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: issued.sessionId });
  assert.equal(throttled.lastActivityAt?.getTime(), touched.lastActivityAt?.getTime());

  const revoked = await client.store.createBrowserSession(userId);
  await cleanup.query(
    `UPDATE auth_session
     SET revoked_at = clock_timestamp(), revocation_reason = 'logout'
     WHERE id = $1`,
    [revoked.sessionId],
  );
  const revokedBefore = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: revoked.sessionId });
  await assertAuthError(
    client.store.validateBrowserSession(revoked.sessionCredential, true),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  const revokedAfter = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: revoked.sessionId });
  assert.equal(revokedAfter.lastActivityAt?.getTime(), revokedBefore.lastActivityAt?.getTime());

  const expired = await client.store.createBrowserSession(userId);
  await cleanup.query(
    'UPDATE auth_session SET inactivity_expires_at = clock_timestamp() WHERE id = $1',
    [expired.sessionId],
  );
  await assertAuthError(
    client.store.validateBrowserSession(expired.sessionCredential, true),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const absoluteExpired = await client.store.createBrowserSession(userId);
  await cleanup.query(
    `UPDATE auth_session
     SET absolute_expires_at = expired.at,
         inactivity_expires_at = expired.at
     FROM (SELECT clock_timestamp() AS at) expired
     WHERE id = $1`,
    [absoluteExpired.sessionId],
  );
  await assertAuthError(
    client.store.validateBrowserSession(absoluteExpired.sessionCredential, true),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const rollbackSession = await client.store.createBrowserSession(userId);
  await ageBrowserSessionActivity(cleanup, rollbackSession.sessionId);
  const beforeFailure = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: rollbackSession.sessionId });
  const queryRunner = cleanup.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query('SELECT id FROM auth_session WHERE id = $1 FOR UPDATE', [
      rollbackSession.sessionId,
    ]);
    await assertCompletesWithin(
      assertAuthError(
        client.store.validateBrowserSession(rollbackSession.sessionCredential, true),
        AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
      ),
      AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
    );
  } finally {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  }

  const afterFailure = await cleanup
    .getRepository(AuthSession)
    .findOneByOrFail({ id: rollbackSession.sessionId });
  assert.equal(afterFailure.lastActivityAt?.getTime(), beforeFailure.lastActivityAt?.getTime());
  assert.equal(
    afterFailure.inactivityExpiresAt.getTime(),
    beforeFailure.inactivityExpiresAt.getTime(),
  );
}

/** Proves browser credentials persist only digests and create independent session rows. */
export async function verifyBrowserSessionIssuance(
  first: VerificationClient,
  second: VerificationClient,
  userId: string,
  environment: EnvironmentVariables,
): Promise<void> {
  const [left, right] = await Promise.all([
    first.store.createBrowserSession(userId),
    second.store.createBrowserSession(userId),
  ]);

  assert.notEqual(left.sessionId, right.sessionId);
  const session = await first.dataSource
    .getRepository(AuthSession)
    .findOneByOrFail({ id: left.sessionId });

  assert.equal(session.credentialDigest?.length, 64);
  assert.equal(session.credentialDigest?.includes(left.sessionCredential), false);
  assert.equal(session.lastActivityAt?.getTime(), session.createdAt.getTime());
  assert.equal(
    session.absoluteExpiresAt.getTime() - session.createdAt.getTime(),
    environment.AUTH_SESSION_ABSOLUTE_TTL_MS,
  );
  assert.equal(
    session.inactivityExpiresAt.getTime() - session.createdAt.getTime(),
    environment.AUTH_SESSION_IDLE_TTL_MS,
  );
  assert.equal(
    await first.dataSource.getRepository(AuthRefreshToken).countBy({ sessionId: left.sessionId }),
    0,
  );
  await Promise.all([
    first.store.validateBrowserSession(left.sessionCredential, false),
    second.store.validateBrowserSession(right.sessionCredential, false),
  ]);
}

/** Proves both validation-before-logout and logout-before-validation ordering deterministically. */
export async function verifyBrowserSessionLogoutOrderings(
  first: VerificationClient,
  second: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const validationFirst = await first.store.createBrowserSession(userId);
  await first.store.validateBrowserSession(validationFirst.sessionCredential, true);
  await second.store.signOutBrowserSession(validationFirst.sessionCredential);
  await assertAuthError(
    first.store.validateBrowserSession(validationFirst.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const logoutFirst = await first.store.createBrowserSession(userId);
  await second.store.signOutBrowserSession(logoutFirst.sessionCredential);
  await assertAuthError(
    first.store.validateBrowserSession(logoutFirst.sessionCredential, true),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const sessions = await cleanup.getRepository(AuthSession).findBy({
    id: logoutFirst.sessionId,
  });
  assert.equal(sessions.length, 1);
  assert.notEqual(sessions[0]?.revokedAt, null);
}

/** Proves malformed, cross-purpose, legacy, and invalid identity state all fail closed. */
export async function verifyBrowserSessionRejection(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
  environment: EnvironmentVariables,
): Promise<void> {
  const issued = await client.store.createBrowserSession(userId);
  const separatorIndex = issued.sessionCredential.indexOf('.');
  const secret = issued.sessionCredential.slice(separatorIndex + 1);
  const altered = `${issued.sessionCredential.slice(0, separatorIndex + 1)}${
    secret.startsWith('A') ? 'B' : 'A'
  }${secret.slice(1)}`;

  await assertAuthError(
    client.store.validateBrowserSession(altered, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await assertAuthError(
    client.store.validateBrowserSession('malformed', false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const unknownCredential = client.tokens.issue(OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);
  await assertAuthError(
    client.store.validateBrowserSession(unknownCredential.rawToken, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const peer = await client.store.createBrowserSession(userId);
  const peerSecret = peer.sessionCredential.slice(peer.sessionCredential.indexOf('.') + 1);
  await client.store.signOutBrowserSession(`${issued.sessionId}.${peerSecret}`);
  await Promise.all([
    client.store.validateBrowserSession(issued.sessionCredential, false),
    client.store.validateBrowserSession(peer.sessionCredential, false),
  ]);

  const now = await readVerificationDatabaseNow(cleanup);
  const legacyCredential = client.tokens.issue(OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);
  await cleanup.getRepository(AuthSession).insert({
    absoluteExpiresAt: new Date(now.getTime() + environment.AUTH_SESSION_ABSOLUTE_TTL_MS),
    createdAt: now,
    credentialDigest: null,
    id: legacyCredential.id,
    inactivityExpiresAt: new Date(now.getTime() + environment.AUTH_SESSION_IDLE_TTL_MS),
    lastActivityAt: null,
    lastRefreshedAt: now,
    revocationReason: null,
    revokedAt: null,
    userId,
  });
  await assertAuthError(
    client.store.validateBrowserSession(legacyCredential.rawToken, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  const refreshCredential = client.tokens.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);
  await cleanup.getRepository(AuthSession).insert({
    absoluteExpiresAt: new Date(now.getTime() + environment.AUTH_SESSION_ABSOLUTE_TTL_MS),
    createdAt: now,
    credentialDigest: refreshCredential.digest,
    id: refreshCredential.id,
    inactivityExpiresAt: new Date(now.getTime() + environment.AUTH_SESSION_IDLE_TTL_MS),
    lastActivityAt: now,
    lastRefreshedAt: now,
    revocationReason: null,
    revokedAt: null,
    userId,
  });
  await assertAuthError(
    client.store.validateBrowserSession(refreshCredential.rawToken, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );

  await cleanup.getRepository(User).update({ id: userId }, { emailVerifiedAt: null });
  await assertAuthError(
    client.store.validateBrowserSession(issued.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await cleanup.getRepository(User).update(
    { id: userId },
    {
      emailVerifiedAt: now,
      roles: [...PLATFORM_AUTH_ROLES],
      scopes: [...PLATFORM_AUTH_SCOPES],
    },
  );
  await cleanup.getRepository(User).update({ id: userId }, { roles: ['UNSUPPORTED'] });
  await assertAuthError(
    client.store.validateBrowserSession(issued.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await cleanup.getRepository(User).update({ id: userId }, { roles: [...PLATFORM_AUTH_ROLES] });

  const deletedUserId = randomUUID();
  await insertVerifiedUser(client.dataSource, deletedUserId);
  const deletedUserSession = await client.store.createBrowserSession(deletedUserId);
  await cleanup.getRepository(User).delete({ id: deletedUserId });
  assert.equal(
    await cleanup.getRepository(AuthSession).countBy({ id: deletedUserSession.sessionId }),
    0,
  );
  await assertAuthError(
    client.store.validateBrowserSession(deletedUserSession.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
}

/** Ages activity through a JavaScript Date so the fixture matches persisted runtime precision. */
async function ageBrowserSessionActivity(cleanup: DataSource, sessionId: string): Promise<void> {
  const now = await readVerificationDatabaseNow(cleanup);
  const staleActivityAt = new Date(now.getTime() - AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS - 1);

  await cleanup.getRepository(AuthSession).update(
    { id: sessionId },
    {
      createdAt: staleActivityAt,
      lastActivityAt: staleActivityAt,
    },
  );
}
