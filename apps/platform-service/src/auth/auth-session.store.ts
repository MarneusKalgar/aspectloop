import type { EntityManager } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, QueryFailedError } from 'typeorm';

import type { User } from '../users/user.entity';
import type { ActiveAuthSession } from './auth-session.types';
import type { ParsedOpaqueToken } from './opaque-token.service';

import { User as UserEntity } from '../users/user.entity';
import {
  AUTH_LOCK_TIMEOUT_MS,
  AUTH_SESSION_REVOCATION_REASON,
  type AuthSessionRevocationReason,
} from './auth.constants';
import { AuthRefreshToken } from './model/auth-refresh-token.entity';
import { AuthSession } from './model/auth-session.entity';
import { OPAQUE_TOKEN_PURPOSE, OpaqueTokenService } from './opaque-token.service';
import { PlatformAuthException } from './platform-auth.exception';

interface AuthenticatedTokenReference {
  parsed: ParsedOpaqueToken;
  sessionId: string;
  userId: string;
}

interface DatabaseClockRow {
  now: unknown;
}

interface LockedSessionState {
  session: AuthSession;
  token: AuthRefreshToken;
  user: User;
}

type RefreshTransactionResult = ActiveAuthSession | { outcome: 'replayed' };

@Injectable()
export class AuthSessionStore {
  private readonly absoluteTtlMs: number;
  private readonly idleTtlMs: number;
  private readonly refreshGraceMs: number;

  /** Creates the transactional session authority from validated Platform configuration. */
  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly opaqueTokenService: OpaqueTokenService,
  ) {
    this.absoluteTtlMs = configService.getOrThrow<number>('AUTH_SESSION_ABSOLUTE_TTL_MS');
    this.idleTtlMs = configService.getOrThrow<number>('AUTH_SESSION_IDLE_TTL_MS');
    this.refreshGraceMs = configService.getOrThrow<number>('AUTH_REFRESH_GRACE_MS');
  }

  /**
   * Creates a new independent session family for one verified user.
   *
   * @param userId Authenticated user identifier.
   * @returns Persisted family state and the only copy of its raw refresh secret.
   */
  async create(userId: string): Promise<ActiveAuthSession> {
    return this.withDatabaseBoundary(() =>
      this.withLockedTransaction(async (manager) => {
        const user = await manager.getRepository(UserEntity).findOne({
          lock: { mode: 'pessimistic_write' },
          where: { id: userId },
        });

        if (!user) {
          throw new PlatformAuthException(
            AUTH_ERROR_CODE.SESSION_INVALID,
            'Authentication session is invalid',
          );
        }

        if (!user.emailVerifiedAt) {
          throw new PlatformAuthException(
            AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
            'Email confirmation is required',
          );
        }

        const now = await readDatabaseNow(manager);
        const absoluteExpiresAt = addMilliseconds(now, this.absoluteTtlMs);
        const inactivityExpiresAt = minDate(
          addMilliseconds(now, this.idleTtlMs),
          absoluteExpiresAt,
        );
        const sessionId = randomUUID();
        const issuedToken = this.opaqueTokenService.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);

        await manager.getRepository(AuthSession).insert({
          absoluteExpiresAt,
          createdAt: now,
          id: sessionId,
          inactivityExpiresAt,
          lastRefreshedAt: now,
          revocationReason: null,
          revokedAt: null,
          userId: user.id,
        });
        await manager.getRepository(AuthRefreshToken).insert({
          createdAt: now,
          expiresAt: inactivityExpiresAt,
          id: issuedToken.id,
          replacementTokenId: null,
          revokedAt: null,
          rotatedAt: null,
          sessionId,
          tokenDigest: issuedToken.digest,
        });

        return {
          effectiveExpiresAt: inactivityExpiresAt,
          issuedAt: now,
          refreshToken: issuedToken.rawToken,
          sessionId,
          user,
        };
      }),
    );
  }

  /**
   * Confirms that bearer subject and session claims still identify active persisted state.
   *
   * @param userId Validated JWT subject.
   * @param sessionId Validated JWT session-family identifier.
   * @returns Current authoritative user entity.
   */
  async getActiveUser(userId: string, sessionId: string): Promise<User> {
    return this.withDatabaseBoundary(() =>
      this.dataSource.transaction(async (manager) => {
        const now = await readDatabaseNow(manager);
        const session = await manager.getRepository(AuthSession).findOne({
          where: { id: sessionId, userId },
        });
        const user = await manager.getRepository(UserEntity).findOne({ where: { id: userId } });

        if (!session || !user || !isActiveSession(session, user, now)) {
          throw new PlatformAuthException(
            AUTH_ERROR_CODE.SESSION_INVALID,
            'Authentication session is invalid',
          );
        }

        return user;
      }),
    );
  }

  /**
   * Atomically rotates a current refresh token or applies predecessor-replay policy.
   *
   * @param rawToken Untrusted opaque refresh token from Gateway.
   * @returns Successor secret and current authoritative user/session state.
   */
  async refresh(rawToken: string): Promise<ActiveAuthSession> {
    return this.withDatabaseBoundary(async () => {
      const reference = await this.authenticateReference(rawToken);

      if (!reference) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.SESSION_INVALID,
          'Authentication session is invalid',
        );
      }

      const result = await this.withLockedTransaction((manager) =>
        this.rotateInTransaction(manager, reference),
      );

      if ('outcome' in result) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.SESSION_INVALID,
          'Authentication session is invalid',
        );
      }

      return result;
    });
  }

  /**
   * Revokes the family proven by a valid current or historical refresh secret.
   *
   * Missing, malformed, and incorrect secrets are intentionally idempotent no-ops.
   *
   * @param rawToken Untrusted opaque refresh token from Gateway.
   */
  async signOut(rawToken: string): Promise<void> {
    await this.withDatabaseBoundary(async () => {
      const reference = await this.authenticateReference(rawToken);

      if (!reference) {
        return;
      }

      await this.withLockedTransaction(async (manager) => {
        const state = await this.lockSessionState(manager, reference);

        if (
          !state ||
          !this.opaqueTokenService.matches(reference.parsed.digest, state.token.tokenDigest)
        ) {
          return;
        }

        if (!state.session.revokedAt) {
          const now = await readDatabaseNow(manager);
          await this.revokeFamily(
            manager,
            state.session,
            now,
            AUTH_SESSION_REVOCATION_REASON.LOGOUT,
          );
        }
      });
    });
  }

  /** Authenticates a candidate secret before any transaction may mutate its family. */
  private async authenticateReference(
    rawToken: string,
  ): Promise<AuthenticatedTokenReference | null> {
    const parsed = this.opaqueTokenService.parse(rawToken, OPAQUE_TOKEN_PURPOSE.REFRESH);

    if (!parsed) {
      return null;
    }

    const token = await this.dataSource.getRepository(AuthRefreshToken).findOne({
      where: { id: parsed.id },
    });

    if (!token || !this.opaqueTokenService.matches(parsed.digest, token.tokenDigest)) {
      return null;
    }

    const session = await this.dataSource.getRepository(AuthSession).findOne({
      where: { id: token.sessionId },
    });

    return session ? { parsed, sessionId: session.id, userId: session.userId } : null;
  }

  /** Locks user, family, and token in the mandatory global order. */
  private async lockSessionState(
    manager: EntityManager,
    reference: AuthenticatedTokenReference,
  ): Promise<LockedSessionState | null> {
    const user = await manager.getRepository(UserEntity).findOne({
      lock: { mode: 'pessimistic_write' },
      where: { id: reference.userId },
    });

    if (!user) {
      return null;
    }

    const session = await manager.getRepository(AuthSession).findOne({
      lock: { mode: 'pessimistic_write' },
      where: { id: reference.sessionId, userId: reference.userId },
    });

    if (!session) {
      return null;
    }

    const token = await manager.getRepository(AuthRefreshToken).findOne({
      lock: { mode: 'pessimistic_write' },
      where: { id: reference.parsed.id, sessionId: session.id },
    });

    return token ? { session, token, user } : null;
  }

  /** Persists family revocation and marks every retained token terminal. */
  private async revokeFamily(
    manager: EntityManager,
    session: AuthSession,
    now: Date,
    reason: AuthSessionRevocationReason,
  ): Promise<void> {
    session.revocationReason = reason;
    session.revokedAt = now;
    await manager.getRepository(AuthSession).save(session);
    await manager
      .getRepository(AuthRefreshToken)
      .update({ revokedAt: IsNull(), sessionId: session.id }, { revokedAt: now });
  }

  /** Rotates or revokes while all relevant rows remain locked. */
  private async rotateInTransaction(
    manager: EntityManager,
    reference: AuthenticatedTokenReference,
  ): Promise<RefreshTransactionResult> {
    const state = await this.lockSessionState(manager, reference);

    if (
      !state ||
      !this.opaqueTokenService.matches(reference.parsed.digest, state.token.tokenDigest)
    ) {
      throw new PlatformAuthException(
        AUTH_ERROR_CODE.SESSION_INVALID,
        'Authentication session is invalid',
      );
    }

    const now = await readDatabaseNow(manager);

    if (!isActiveSession(state.session, state.user, now)) {
      throw new PlatformAuthException(
        AUTH_ERROR_CODE.SESSION_INVALID,
        'Authentication session is invalid',
      );
    }

    if (state.token.rotatedAt) {
      const graceExpiresAt = addMilliseconds(state.token.rotatedAt, this.refreshGraceMs);

      if (now.getTime() <= graceExpiresAt.getTime()) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.REFRESH_CONFLICT,
          'Refresh is already in progress',
        );
      }

      await this.revokeFamily(
        manager,
        state.session,
        now,
        AUTH_SESSION_REVOCATION_REASON.REFRESH_REUSE,
      );

      return { outcome: 'replayed' };
    }

    if (state.token.revokedAt || state.token.expiresAt.getTime() <= now.getTime()) {
      throw new PlatformAuthException(
        AUTH_ERROR_CODE.SESSION_INVALID,
        'Authentication session is invalid',
      );
    }

    const effectiveExpiresAt = minDate(
      addMilliseconds(now, this.idleTtlMs),
      state.session.absoluteExpiresAt,
    );
    const issuedToken = this.opaqueTokenService.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);
    const tokenRepository = manager.getRepository(AuthRefreshToken);

    state.token.rotatedAt = now;
    await tokenRepository.save(state.token);
    await tokenRepository.insert({
      createdAt: now,
      expiresAt: effectiveExpiresAt,
      id: issuedToken.id,
      replacementTokenId: null,
      revokedAt: null,
      rotatedAt: null,
      sessionId: state.session.id,
      tokenDigest: issuedToken.digest,
    });
    state.token.replacementTokenId = issuedToken.id;
    await tokenRepository.save(state.token);

    state.session.inactivityExpiresAt = effectiveExpiresAt;
    state.session.lastRefreshedAt = now;
    await manager.getRepository(AuthSession).save(state.session);

    return {
      effectiveExpiresAt,
      issuedAt: now,
      refreshToken: issuedToken.rawToken,
      sessionId: state.session.id,
      user: state.user,
    };
  }

  /** Converts database failures into the only dependency error allowed by the auth contract. */
  private async withDatabaseBoundary<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
          'Authentication dependency is unavailable',
        );
      }

      throw error;
    }
  }

  /** Runs a short transaction with a bounded PostgreSQL row-lock wait. */
  private async withLockedTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('lock_timeout', $1, true)", [
        `${AUTH_LOCK_TIMEOUT_MS}ms`,
      ]);

      return await work(manager);
    });
  }
}

/** Adds a validated duration without leaking application-host time into decisions. */
function addMilliseconds(value: Date, durationMs: number): Date {
  return new Date(value.getTime() + durationMs);
}

/** Returns whether persisted family and user state may authorize refresh or me. */
function isActiveSession(session: AuthSession, user: User, now: Date): boolean {
  return (
    user.emailVerifiedAt !== null &&
    session.revokedAt === null &&
    session.absoluteExpiresAt.getTime() > now.getTime() &&
    session.inactivityExpiresAt.getTime() > now.getTime()
  );
}

/** Narrows an arbitrary query response to the expected database-clock row. */
function isDatabaseClockResult(rows: unknown): rows is [DatabaseClockRow, ...unknown[]] {
  if (!Array.isArray(rows)) {
    return false;
  }

  const firstRow: unknown = rows[0];

  return firstRow !== null && typeof firstRow === 'object' && 'now' in firstRow;
}

/** Returns the earlier of two expiry boundaries. */
function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

/** Reads PostgreSQL's wall clock for all expiry and grace decisions. */
async function readDatabaseNow(manager: EntityManager): Promise<Date> {
  const rows = await manager.query<unknown>('SELECT clock_timestamp() AS "now"');

  if (
    !isDatabaseClockResult(rows) ||
    !(rows[0].now instanceof Date) ||
    Number.isNaN(rows[0].now.getTime())
  ) {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
      'Authentication dependency is unavailable',
    );
  }

  return rows[0].now;
}
