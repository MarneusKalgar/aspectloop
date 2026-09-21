import { PLATFORM_AUTH_ROLES, PLATFORM_AUTH_SCOPES } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';

import type {
  IssuedOpaqueToken,
  OpaqueTokenPurpose,
} from '#app/auth/credentials/opaque-token.service';
import type { EnvironmentVariables } from '#app/config/env.schema';

import { OpaqueTokenService } from '#app/auth/credentials/opaque-token.service';
import { PlatformAuthException } from '#app/auth/platform-auth.exception';
import { AuthSessionStore } from '#app/auth/sessions/auth-session.store';
import { AUTH_LOCK_TIMEOUT_MS } from '#app/auth/sessions/session.constants';
import { getTypeOrmDataSourceOptions } from '#app/config/typeorm';
import { User } from '#app/users/user.entity';

export interface VerificationClient {
  dataSource: DataSource;
  store: AuthSessionStore;
  tokens: OpaqueTokenService;
}

/** Injects one deterministic token-identity collision into the local rollback scenario. */
export class FaultInjectingOpaqueTokenService extends OpaqueTokenService {
  private nextIssuedToken: IssuedOpaqueToken | null = null;

  /** Arms exactly one issue call with a fixture-owned colliding token identity. */
  failNextIssueWith(token: IssuedOpaqueToken): void {
    assert.equal(this.nextIssuedToken, null, 'A token issuance failure is already armed');
    this.nextIssuedToken = token;
  }

  /** Issues the armed fixture token once, then resumes production token generation. */
  override issue(purpose: OpaqueTokenPurpose): IssuedOpaqueToken {
    if (this.nextIssuedToken) {
      const token = this.nextIssuedToken;
      this.nextIssuedToken = null;

      return token;
    }

    return super.issue(purpose);
  }
}

export const AUTH_LOCK_VERIFY_EARLY_TOLERANCE_MS = 500;
export const AUTH_LOCK_VERIFY_COMPLETION_GRACE_MS = 3000;
export const AUTH_LOCK_VERIFY_MIN_ELAPSED_MS =
  AUTH_LOCK_TIMEOUT_MS - AUTH_LOCK_VERIFY_EARLY_TOLERANCE_MS;
export const AUTH_LOCK_VERIFY_MAX_ELAPSED_MS =
  AUTH_LOCK_TIMEOUT_MS + AUTH_LOCK_VERIFY_COMPLETION_GRACE_MS;

/** Asserts that a promise rejects with one allowlisted Platform auth code. */
export async function assertAuthError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => hasAuthErrorCode(error, expectedCode));
}

/** Bounds a verification assertion independently from the behavior it is measuring. */
export async function assertCompletesWithin(
  operation: Promise<void>,
  timeoutMs: number,
): Promise<void> {
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
export function assertLocalVerificationTarget(runtimeUrl: string, cleanupUrl: string): void {
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

/** Creates one runtime-credentialed client backed by its own PostgreSQL pool. */
export function createVerificationClient(
  environment: EnvironmentVariables,
  opaqueTokenService = new OpaqueTokenService(new ConfigService(environment)),
): VerificationClient {
  const dataSource = createVerificationDataSource(environment.DATABASE_URL, environment, 2);
  const configService = new ConfigService(environment);

  return {
    dataSource,
    store: new AuthSessionStore(dataSource, configService, opaqueTokenService),
    tokens: opaqueTokenService,
  };
}

/** Creates a source-discovery datasource for runtime operations or fixture cleanup. */
export function createVerificationDataSource(
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

/** Returns whether an unknown rejection carries the exact allowlisted Platform auth code. */
export function hasAuthErrorCode(error: unknown, expectedCode: string): boolean {
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
export async function insertVerifiedUser(dataSource: DataSource, userId: string): Promise<void> {
  await dataSource.getRepository(User).insert({
    displayName: 'Auth verification fixture',
    email: `auth-verify-${userId}@example.test`,
    emailVerifiedAt: new Date(),
    id: userId,
    passwordHash: 'verification-only-hash',
    roles: [...PLATFORM_AUTH_ROLES],
    scopes: [...PLATFORM_AUTH_SCOPES],
  });
}

/** Returns the required cleanup URL without ever printing its embedded credentials. */
export function readCleanupDatabaseUrl(): string {
  const value = process.env.AUTH_VERIFY_CLEANUP_DATABASE_URL;

  if (!value) {
    throw new Error('AUTH_VERIFY_CLEANUP_DATABASE_URL is required');
  }

  return value;
}

/** Reads PostgreSQL time for verification fixtures without using the application host clock. */
export async function readVerificationDatabaseNow(dataSource: DataSource): Promise<Date> {
  const rows: unknown = (await dataSource.query('SELECT clock_timestamp() AS "now"')) as unknown;

  if (!isDatabaseClockRows(rows) || !(rows[0].now instanceof Date)) {
    throw new Error('Verification database clock was unavailable');
  }

  return rows[0].now;
}

/** Prints one credential-free scenario result for human verification evidence. */
export function reportScenario(id: string, summary: string): void {
  console.log(`${id} PASS: ${summary}.`);
}

/** Narrows an arbitrary driver response to a non-empty database-clock result. */
function isDatabaseClockRows(rows: unknown): rows is [{ now: unknown }, ...unknown[]] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  const firstRow: unknown = rows[0] as unknown;

  return firstRow !== null && typeof firstRow === 'object' && 'now' in firstRow;
}
