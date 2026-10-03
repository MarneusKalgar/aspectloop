import type { EntityManager } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import type { User } from '#app/users/user.entity';

import { User as UserEntity } from '#app/users/user.entity';

import type { ParsedOpaqueToken } from '../credentials/opaque-token.service';
import type { IssuedBrowserSession, ValidatedBrowserSession } from './session.types';

import { hasAllowedPlatformAuthorization } from '../authorization/authorization.policy';
import { OPAQUE_TOKEN_PURPOSE, OpaqueTokenService } from '../credentials/opaque-token.service';
import { readAuthDatabaseNow } from '../persistence/database-clock';
import { isAuthDatabaseUnavailableError } from '../persistence/database.errors';
import { PlatformAuthException } from '../platform-auth.exception';
import { AuthSession } from './model/auth-session.entity';
import { AUTH_LOCK_TIMEOUT_MS, AUTH_SESSION_REVOCATION_REASON } from './session.constants';
import {
  createAuthSessionExpiry,
  isAuthSessionActive,
  nextAuthSessionInactivityExpiry,
  shouldRecordAuthSessionActivity,
} from './session.policy';

interface BrowserSessionState {
  session: AuthSession;
  user: User;
}

@Injectable()
export class AuthSessionStore {
  private readonly absoluteTtlMs: number;
  private readonly idleTtlMs: number;

  /** Creates the transactional session authority from validated Platform configuration. */
  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly opaqueTokenService: OpaqueTokenService,
  ) {
    this.absoluteTtlMs = configService.getOrThrow<number>('AUTH_SESSION_ABSOLUTE_TTL_MS');
    this.idleTtlMs = configService.getOrThrow<number>('AUTH_SESSION_IDLE_TTL_MS');
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

  /** Rejects browser-session authentication without revealing which state failed. */
  private rejectInvalidSession(): never {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.SESSION_INVALID,
      'Authentication session is invalid',
    );
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
