import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import assert from 'node:assert/strict';
import { QueryFailedError } from 'typeorm';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { AuthSession } from '#app/auth/sessions/model/auth-session.entity';

import type { FaultInjectingOpaqueTokenService, VerificationClient } from './verification-support';

import {
  assertAuthError,
  assertCompletesWithin,
  AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
  AUTH_LOCK_VERIFY_MIN_ELAPSED_MS,
} from './verification-support';

/** Proves an occupied user lock fails within the configured bounded wait. */
export async function verifyBoundedLockWait(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const lock = cleanup.createQueryRunner();
  await lock.connect();
  await lock.startTransaction();
  try {
    await lock.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const startedAt = Date.now();
    await assertCompletesWithin(
      assertAuthError(
        client.store.createBrowserSession(userId),
        AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
      ),
      AUTH_LOCK_VERIFY_MAX_ELAPSED_MS,
    );
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= AUTH_LOCK_VERIFY_MIN_ELAPSED_MS);
    assert.ok(elapsedMs <= AUTH_LOCK_VERIFY_MAX_ELAPSED_MS);
  } finally {
    await lock.rollbackTransaction();
    await lock.release();
  }
}

/** Proves failed issuance leaves existing sessions unchanged and preserves integrity errors. */
export async function verifyIssuanceRollback(
  client: VerificationClient,
  tokens: FaultInjectingOpaqueTokenService,
  userId: string,
): Promise<void> {
  const issued = await client.store.createBrowserSession(userId);
  const parsed = tokens.parse(issued.sessionCredential, OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);
  assert.ok(parsed);
  const repository = client.dataSource.getRepository(AuthSession);
  const before = await repository.findOneByOrFail({ id: issued.sessionId });
  const countBefore = await repository.countBy({ userId });
  tokens.failNextIssueWith({ ...parsed, rawToken: issued.sessionCredential });
  await assert.rejects(
    client.store.createBrowserSession(userId),
    /** Keeps unexpected integrity failures outside the transient-error classifier. */
    (error: unknown) => error instanceof QueryFailedError,
  );
  assert.equal(await repository.countBy({ userId }), countBefore);
  assert.deepEqual(await repository.findOneByOrFail({ id: issued.sessionId }), before);
  await client.store.validateBrowserSession(issued.sessionCredential, false);
  await client.store.createBrowserSession(userId);
}

/** Proves expired and repeated logout remains idempotent without revoking a peer login. */
export async function verifyLogoutSemantics(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const issued = await client.store.createBrowserSession(userId);
  const peer = await client.store.createBrowserSession(userId);
  await cleanup.query(
    'UPDATE auth_session SET inactivity_expires_at = clock_timestamp() WHERE id = $1',
    [issued.sessionId],
  );
  await client.store.signOutBrowserSession(issued.sessionCredential);
  await client.store.signOutBrowserSession(issued.sessionCredential);
  await client.store.signOutBrowserSession('malformed');
  const row = await cleanup.getRepository(AuthSession).findOneByOrFail({ id: issued.sessionId });
  assert.ok(row.revokedAt);
  assert.equal(row.revocationReason, 'logout');
  await assertAuthError(
    client.store.validateBrowserSession(issued.sessionCredential, false),
    AUTH_ERROR_CODE.SESSION_INVALID,
  );
  await client.store.validateBrowserSession(peer.sessionCredential, false);
}

/** Requires the reviewed retirement migration rather than silently testing an old schema. */
export async function verifyRetiredSchema(cleanup: DataSource): Promise<void> {
  const rows: unknown = await cleanup.query(
    `SELECT to_regclass('public.auth_refresh_token') IS NULL AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'auth_session'
         AND column_name = 'last_refreshed_at'
     ) AS retired`,
  );
  assert.deepEqual(rows, [{ retired: true }]);
}
