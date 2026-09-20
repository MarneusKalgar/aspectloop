import 'reflect-metadata';
import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull } from 'typeorm';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { AuthSessionStore } from '#app/auth/auth-session.store';
import { AUTH_LOCK_TIMEOUT_MS } from '#app/auth/auth.constants';
import { AuthRefreshToken } from '#app/auth/model/auth-refresh-token.entity';
import { AuthSession } from '#app/auth/model/auth-session.entity';
import {
  type IssuedOpaqueToken,
  OPAQUE_TOKEN_PURPOSE,
  type OpaqueTokenPurpose,
  OpaqueTokenService,
} from '#app/auth/opaque-token.service';
import { PlatformAuthException } from '#app/auth/platform-auth.exception';
import { validateEnv } from '#app/config/env.validation';
import { getTypeOrmDataSourceOptions } from '#app/config/typeorm';
import { User } from '#app/users/user.entity';

interface VerificationClient {
  dataSource: DataSource;
  store: AuthSessionStore;
}

/** Injects one deterministic token-identity collision into the local rollback scenario. */
class FaultInjectingOpaqueTokenService extends OpaqueTokenService {
  private nextIssuedToken: IssuedOpaqueToken | null = null;

  /** Arms exactly one issue call with a fixture-owned colliding token identity. */
  failNextIssueWith(token: IssuedOpaqueToken): void {
    assert.equal(this.nextIssuedToken, null, 'A token issuance failure is already armed');
    this.nextIssuedToken = token;
  }

  override issue(purpose: OpaqueTokenPurpose): IssuedOpaqueToken {
    if (this.nextIssuedToken) {
      const token = this.nextIssuedToken;
      this.nextIssuedToken = null;

      return token;
    }

    return super.issue(purpose);
  }
}

const AUTH_LOCK_VERIFY_EARLY_TOLERANCE_MS = 500;
const AUTH_LOCK_VERIFY_COMPLETION_GRACE_MS = 3000;
const AUTH_LOCK_VERIFY_MIN_ELAPSED_MS = AUTH_LOCK_TIMEOUT_MS - AUTH_LOCK_VERIFY_EARLY_TOLERANCE_MS;
const AUTH_LOCK_VERIFY_MAX_ELAPSED_MS = AUTH_LOCK_TIMEOUT_MS + AUTH_LOCK_VERIFY_COMPLETION_GRACE_MS;

/** Asserts that a promise rejects with one allowlisted Platform auth code. */
async function assertAuthError(operation: Promise<unknown>, expectedCode: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => hasAuthErrorCode(error, expectedCode));
}

/** Bounds a verification assertion independently from the behavior it is measuring. */
async function assertCompletesWithin(operation: Promise<void>, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutFailure = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Verification operation exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([operation, timeoutFailure]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

/** Refuses direct or remote targets outside the repository-owned local Compose network. */
function assertLocalVerificationTarget(runtimeUrl: string, cleanupUrl: string): void {
  const runtime = new URL(runtimeUrl);
  const cleanup = new URL(cleanupUrl);

  if (
    runtime.protocol !== 'postgresql:' ||
    cleanup.protocol !== 'postgresql:' ||
    runtime.hostname !== 'postgres' ||
    cleanup.hostname !== 'postgres' ||
    runtime.pathname !== cleanup.pathname ||
    runtime.username === cleanup.username
  ) {
    throw new Error('Auth-session verification requires the isolated local Compose database');
  }
}

/** Creates a source-discovery datasource for either runtime operations or fixture cleanup. */
function createDataSource(
  databaseUrl: string,
  environment: EnvironmentVariables,
  poolSize: number,
): DataSource {
  return new DataSource(
    getTypeOrmDataSourceOptions({
      databaseUrl,
      discoveryMode: 'source',
      nodeEnv: environment.NODE_ENV,
      poolSize,
      slowQueryThresholdMs: environment.DB_SLOW_QUERY_THRESHOLD_MS,
    }),
  );
}

/** Creates one runtime-credentialed client backed by its own PostgreSQL pool. */
function createVerificationClient(
  environment: EnvironmentVariables,
  opaqueTokenService = new OpaqueTokenService(new ConfigService(environment)),
): VerificationClient {
  const dataSource = createDataSource(environment.DATABASE_URL, environment, 2);
  const configService = new ConfigService(environment);

  return {
    dataSource,
    store: new AuthSessionStore(dataSource, configService, opaqueTokenService),
  };
}

/** Reports only the error class because auth errors may be credential-adjacent. */
function handleFailure(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform auth-session verification failed (${errorName}); details omitted.`);
  process.exitCode = 1;
}

/** Returns whether an unknown rejection carries the exact allowlisted Platform auth code. */
function hasAuthErrorCode(error: unknown, expectedCode: string): boolean {
  if (!(error instanceof PlatformAuthException)) {
    return false;
  }

  const response: unknown = error.getResponse();

  return (
    response !== null &&
    typeof response === 'object' &&
    'code' in response &&
    response.code === expectedCode
  );
}

/** Inserts one verified, uniquely identifiable user through runtime privileges. */
async function insertVerifiedUser(dataSource: DataSource, userId: string): Promise<void> {
  await dataSource.getRepository(User).insert({
    displayName: 'Auth verification fixture',
    email: `auth-verify-${userId}@example.test`,
    emailVerifiedAt: new Date(),
    id: userId,
    passwordHash: 'verification-only-hash',
    roles: ['CORRECTOR'],
    scopes: ['corrections:write'],
  });
}

/** Runs real PostgreSQL verification through runtime credentials and cleans only its owned user. */
async function main(): Promise<void> {
  const environment = validateEnv(process.env);
  const cleanupDatabaseUrl = readCleanupDatabaseUrl();
  assertLocalVerificationTarget(environment.DATABASE_URL, cleanupDatabaseUrl);
  const faultInjectingTokens = new FaultInjectingOpaqueTokenService(new ConfigService(environment));
  const first = createVerificationClient(environment, faultInjectingTokens);
  const second = createVerificationClient(environment);
  const cleanup = createDataSource(cleanupDatabaseUrl, environment, 1);
  const userId = randomUUID();

  try {
    await Promise.all([
      first.dataSource.initialize(),
      second.dataSource.initialize(),
      cleanup.initialize(),
    ]);
    await insertVerifiedUser(first.dataSource, userId);
    await verifyIssuancePersistence(first, environment, userId);
    reportScenario('AUTH-B01', 'digest-only issuance and configured TTL bounds');
    await verifyRotationAndReplay(first, second, cleanup, userId, environment);
    reportScenario('AUTH-B02', 'single rotation winner and durable replay revocation');
    await verifyIndependentFamilies(first, second, userId);
    reportScenario('AUTH-B03', 'independent session families');
    await verifyLogoutSemantics(first, cleanup, userId);
    reportScenario('AUTH-B04', 'current, historical, expired, and invalid logout secrets');
    await verifyRefreshLogoutRace(first, second, userId);
    reportScenario('AUTH-B05', 'refresh/logout serialization and peer-family isolation');
    await verifyExpiryBoundaries(first, cleanup, userId);
    reportScenario('AUTH-B06', 'inactivity and absolute expiry boundaries');
    await verifyBoundedLockWait(first, cleanup, userId);
    reportScenario('AUTH-B07', 'bounded lock wait maps to dependency unavailable');
    await verifyRotationRollback(first, faultInjectingTokens, userId);
    reportScenario('AUTH-B08', 'failed rotation rolls back predecessor and family state');
    await verifyDeletedUser(first, cleanup, userId);
    reportScenario('AUTH-B09', 'deleted-user cascade and fail-closed refresh');
    console.log(
      'Platform auth-session verification passed: digest-only storage, TTLs, rotation, rollback, replay revocation, independent families, logout.',
    );
  } finally {
    try {
      if (cleanup.isInitialized) {
        await cleanup.getRepository(User).delete({ id: userId });
      }
    } finally {
      await Promise.all(
        [first.dataSource, second.dataSource, cleanup]
          .filter((dataSource) => dataSource.isInitialized)
          .map((dataSource) => dataSource.destroy()),
      );
    }
  }
}

/** Returns the required cleanup URL without ever printing its embedded credentials. */
function readCleanupDatabaseUrl(): string {
  const value = process.env.AUTH_VERIFY_CLEANUP_DATABASE_URL;

  if (!value) {
    throw new Error('AUTH_VERIFY_CLEANUP_DATABASE_URL is required');
  }

  return value;
}

/** Prints one credential-free scenario result for human verification evidence. */
function reportScenario(id: string, summary: string): void {
  console.log(`${id} PASS: ${summary}.`);
}

/** Proves an occupied user lock fails within the configured bounded wait. */
async function verifyBoundedLockWait(
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
async function verifyDeletedUser(
  client: VerificationClient,
  cleanup: DataSource,
  userId: string,
): Promise<void> {
  const issued = await client.store.create(userId);
  const sessionIds = (
    await cleanup.getRepository(AuthSession).find({ select: { id: true }, where: { userId } })
  ).map((session) => session.id);

  assert.ok(sessionIds.includes(issued.sessionId));
  await cleanup.getRepository(User).delete({ id: userId });
  assert.equal(await cleanup.getRepository(AuthSession).countBy({ userId }), 0);
  assert.equal(
    await cleanup.getRepository(AuthRefreshToken).countBy({ sessionId: In(sessionIds) }),
    0,
  );
  await assertAuthError(client.store.refresh(issued.refreshToken), AUTH_ERROR_CODE.SESSION_INVALID);
}

/** Proves both persisted inactivity and absolute boundaries fail closed. */
async function verifyExpiryBoundaries(
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
async function verifyIndependentFamilies(
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
async function verifyIssuancePersistence(
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
async function verifyLogoutSemantics(
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
async function verifyRefreshLogoutRace(
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
async function verifyRotationAndReplay(
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

/** Proves a successor-insert failure rolls every earlier rotation mutation back. */
async function verifyRotationRollback(
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
  await assertAuthError(
    client.store.refresh(issued.refreshToken),
    AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
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

void main().catch(handleFailure);
