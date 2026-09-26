import type { EntityManager } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import type { User } from '#app/users/user.entity';

import { User as UserEntity } from '#app/users/user.entity';

import type { ParsedOpaqueToken } from '../credentials/opaque-token.service';
import type {
  ActiveAuthSession,
  IssuedBrowserSession,
  ValidatedBrowserSession,
} from './session.types';

import { hasAllowedPlatformAuthorization } from '../authorization/authorization.policy';
import { OPAQUE_TOKEN_PURPOSE, OpaqueTokenService } from '../credentials/opaque-token.service';
import { readAuthDatabaseNow } from '../persistence/database-clock';
import { isAuthDatabaseUnavailableError } from '../persistence/database.errors';
import { PlatformAuthException } from '../platform-auth.exception';
import { AuthRefreshToken } from './model/auth-refresh-token.entity';
import { AuthSession } from './model/auth-session.entity';
import {
  AUTH_LOCK_TIMEOUT_MS,
  AUTH_SESSION_REVOCATION_REASON,
  type AuthSessionRevocationReason,
} from './session.constants';
import {
  addMilliseconds,
  createAuthSessionExpiry,
  isAuthSessionActive,
  minDate,
  nextAuthSessionInactivityExpiry,
  shouldRecordAuthSessionActivity,
} from './session.policy';

interface AuthenticatedTokenReference {
  parsed: ParsedOpaqueToken;
  sessionId: string;
  userId: string;
}

interface BrowserSessionState {
  session: AuthSession;
  user: User;
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

        const now = await readAuthDatabaseNow(manager);
        const { absoluteExpiresAt, inactivityExpiresAt } = createAuthSessionExpiry(
          now,
          this.absoluteTtlMs,
          this.idleTtlMs,
        );
        const sessionId = randomUUID();
        const issuedToken = this.opaqueTokenService.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);

        await manager.getRepository(AuthSession).insert({
          absoluteExpiresAt,
          createdAt: now,
          credentialDigest: null,
          id: sessionId,
          inactivityExpiresAt,
          lastActivityAt: null,
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

  /** Creates a new opaque browser session without creating a refresh-token family. */
  async createBrowserSession(userId: string): Promise<IssuedBrowserSession> {
    return this.withDatabaseBoundary(() =>
      this.withLockedTransaction(async (manager) => {
        const user = await manager.getRepository(UserEntity).findOne({
          lock: { mode: 'pessimistic_write' },
          where: { id: userId },
        });

        if (!user?.emailVerifiedAt || !hasAllowedPlatformAuthorization(user)) {
          this.rejectInvalidSession();
        }

        const now = await readAuthDatabaseNow(manager);
        const { absoluteExpiresAt, inactivityExpiresAt } = createAuthSessionExpiry(
          now,
          this.absoluteTtlMs,
          this.idleTtlMs,
        );
        const issuedToken = this.opaqueTokenService.issue(OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION);

        await manager.getRepository(AuthSession).insert({
          absoluteExpiresAt,
          createdAt: now,
          credentialDigest: issuedToken.digest,
          id: issuedToken.id,
          inactivityExpiresAt,
          lastActivityAt: now,
          lastRefreshedAt: now,
          revocationReason: null,
          revokedAt: null,
          userId: user.id,
        });

        return {
          sessionCredential: issuedToken.rawToken,
          sessionExpiresAt: absoluteExpiresAt,
          sessionId: issuedToken.id,
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
        const now = await readAuthDatabaseNow(manager);
        const session = await manager.getRepository(AuthSession).findOne({
          where: { id: sessionId, userId },
        });
        const user = await manager.getRepository(UserEntity).findOne({ where: { id: userId } });

        if (!session || !user || !isAuthSessionActive(session, user, now)) {
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
          const now = await readAuthDatabaseNow(manager);
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

  /** Revokes only the browser session authenticated by the supplied opaque secret. */
  async signOutBrowserSession(rawCredential: string): Promise<void> {
    const parsed = this.opaqueTokenService.parse(
      rawCredential,
      OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION,
    );

    if (!parsed) {
      return;
    }

    await this.withDatabaseBoundary(() =>
      this.withLockedTransaction(async (manager) => {
        const session = await manager.getRepository(AuthSession).findOne({
          where: { id: parsed.id },
        });

        if (
          !session?.credentialDigest ||
          !this.opaqueTokenService.matches(parsed.digest, session.credentialDigest) ||
          session.revokedAt
        ) {
          return;
        }

        const now = await readAuthDatabaseNow(manager);
        await manager
          .getRepository(AuthSession)
          .createQueryBuilder()
          .update(AuthSession)
          .set({
            revocationReason: AUTH_SESSION_REVOCATION_REASON.LOGOUT,
            revokedAt: now,
          })
          .where('id = :id', { id: session.id })
          .andWhere('credential_digest = :credentialDigest', {
            credentialDigest: session.credentialDigest,
          })
          .andWhere('revoked_at IS NULL')
          .execute();
      }),
    );
  }

  /** Authenticates an opaque browser session and optionally persists throttled activity. */
  async validateBrowserSession(
    rawCredential: string,
    recordActivity: boolean,
  ): Promise<ValidatedBrowserSession> {
    const parsed = this.opaqueTokenService.parse(
      rawCredential,
      OPAQUE_TOKEN_PURPOSE.BROWSER_SESSION,
    );

    if (!parsed) {
      this.rejectInvalidSession();
    }

    return this.withDatabaseBoundary(() =>
      this.withLockedTransaction(async (manager) => {
        const now = await readAuthDatabaseNow(manager);
        let state = await this.loadValidBrowserSession(manager, parsed, now);

        if (
          recordActivity &&
          state.session.lastActivityAt &&
          shouldRecordAuthSessionActivity(state.session.lastActivityAt, now)
        ) {
          const inactivityExpiresAt = nextAuthSessionInactivityExpiry(
            now,
            this.idleTtlMs,
            state.session.absoluteExpiresAt,
          );
          const result = await manager
            .getRepository(AuthSession)
            .createQueryBuilder()
            .update(AuthSession)
            .set({ inactivityExpiresAt, lastActivityAt: now })
            .where('id = :id', { id: state.session.id })
            .andWhere('credential_digest = :credentialDigest', {
              credentialDigest: state.session.credentialDigest,
            })
            .andWhere('revoked_at IS NULL')
            .andWhere('absolute_expires_at > :now', { now })
            .andWhere('inactivity_expires_at > :now', { now })
            .andWhere('last_activity_at = :lastActivityAt', {
              lastActivityAt: state.session.lastActivityAt,
            })
            .execute();

          if (result.affected !== 1) {
            state = await this.loadValidBrowserSession(manager, parsed, now);
          }
        }

        return {
          sessionExpiresAt: state.session.absoluteExpiresAt,
          sessionId: state.session.id,
          user: state.user,
        };
      }),
    );
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

  /** Loads and authenticates one browser-session row and its current user state. */
  private async loadValidBrowserSession(
    manager: EntityManager,
    parsed: ParsedOpaqueToken,
    now: Date,
  ): Promise<BrowserSessionState> {
    const session = await manager.getRepository(AuthSession).findOne({ where: { id: parsed.id } });

    if (
      !session?.credentialDigest ||
      !session.lastActivityAt ||
      !this.opaqueTokenService.matches(parsed.digest, session.credentialDigest)
    ) {
      this.rejectInvalidSession();
    }

    const user = await manager.getRepository(UserEntity).findOne({
      where: { id: session.userId },
    });

    if (
      !user ||
      !isAuthSessionActive(session, user, now) ||
      !hasAllowedPlatformAuthorization(user)
    ) {
      this.rejectInvalidSession();
    }

    return { session, user };
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

  /** Rejects browser-session authentication without revealing which state failed. */
  private rejectInvalidSession(): never {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.SESSION_INVALID,
      'Authentication session is invalid',
    );
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

    const now = await readAuthDatabaseNow(manager);

    if (!isAuthSessionActive(state.session, state.user, now)) {
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
      if (isAuthDatabaseUnavailableError(error)) {
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

      return work(manager);
    });
  }
}
