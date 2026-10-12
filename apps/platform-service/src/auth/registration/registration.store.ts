import type { EntityManager } from 'typeorm';

import {
  AUTH_ERROR_CODE,
  PLATFORM_AUTH_ROLES,
  PLATFORM_AUTH_SCOPES,
} from '@aspectloop/contracts/platform';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { User } from '#app/users/user.entity';

import type { RegistrationIdentity, RegistrationMailWork } from './registration.types';

import { OPAQUE_TOKEN_PURPOSE, OpaqueTokenService } from '../credentials/opaque-token.service';
import { isAuthDatabaseUnavailableError } from '../persistence/database.errors';
import { PlatformAuthException } from '../platform-auth.exception';
import { AUTH_LOCK_TIMEOUT_MS } from '../sessions/session.constants';
import { EmailVerificationToken } from './model/email-verification-token.entity';

/** Serializes confirmation changes under the owning user row; never accesses browser-session state. */
@Injectable()
export class RegistrationStore {
  private readonly cooldownMs: number;
  private readonly ttlMs: number;

  /** Uses existing validated configuration and purpose-separated token authority. */
  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
    private readonly tokens: OpaqueTokenService,
  ) {
    this.cooldownMs = config.getOrThrow<number>('AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS');
    this.ttlMs = config.getOrThrow<number>('AUTH_EMAIL_CONFIRMATION_TTL_MS');
  }

  /** Consumes once and verifies the user in one transaction, using database-clock expiry checks. */
  async confirm(rawToken: string): Promise<void> {
    const parsed = this.tokens.parse(rawToken, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);

    if (!parsed) {
      this.rejectConfirmation();
    }

    await this.transaction(
      /** Discovery is not authority: user and token state are reread after the user lock. */
      async (manager) => {
        const discovered = await manager
          .getRepository(EmailVerificationToken)
          .findOneBy({ id: parsed.id });

        if (!discovered) {
          this.rejectConfirmation();
        }

        const user = await manager.getRepository(User).findOne({
          lock: { mode: 'pessimistic_write' },
          where: { id: discovered.userId },
        });

        if (!user || user.emailVerifiedAt) {
          this.rejectConfirmation();
        }

        const token = await manager
          .getRepository(EmailVerificationToken)
          .createQueryBuilder('token')
          .where('token.id = :id AND token.user_id = :userId', { id: parsed.id, userId: user.id })
          .andWhere('token.used_at IS NULL AND token.invalidated_at IS NULL')
          .andWhere('token.expires_at > clock_timestamp()')
          .getOne();

        if (!token || !this.tokens.matches(parsed.digest, token.tokenDigest)) {
          this.rejectConfirmation();
        }

        const consumed = await manager
          .getRepository(EmailVerificationToken)
          .createQueryBuilder()
          .update()
          .set({ usedAt: databaseNow })
          .where('id = :id', { id: token.id })
          .andWhere('used_at IS NULL AND invalidated_at IS NULL')
          .andWhere('expires_at > clock_timestamp()')
          .execute();

        if (consumed.affected !== 1) {
          this.rejectConfirmation();
        }

        await manager
          .getRepository(User)
          .createQueryBuilder()
          .update()
          .set({ emailVerifiedAt: databaseNow })
          .where('id = :id', { id: user.id })
          .execute();
      },
    );
  }

  /** Sends no work for unknown/verified/cooldown identities; terminal history preserves cooldown. */
  async resend(email: string): Promise<null | RegistrationMailWork> {
    return this.transaction(
      /** Locks user before reading or mutating its token family. */
      async (manager) => {
        const user = await manager.getRepository(User).findOne({
          lock: { mode: 'pessimistic_write' },
          where: { email },
        });

        return user ? this.issueIfEligible(manager, user) : null;
      },
    );
  }

  /** Creates account plus first token atomically, or preserves a concurrently existing identity. */
  async signUp(input: RegistrationIdentity): Promise<null | RegistrationMailWork> {
    return this.transaction(
      /** Conflict-safe insertion does not abort a transaction or overwrite existing profile/password. */
      async (manager) => {
        await manager.query(
          `INSERT INTO users (id, email, display_name, password_hash, email_verified_at, roles, scopes)
           VALUES ($1, $2, $3, $4, NULL, $5, $6) ON CONFLICT (email) DO NOTHING`,
          [
            randomUUID(),
            input.email,
            input.displayName,
            input.passwordHash,
            [...PLATFORM_AUTH_ROLES],
            [...PLATFORM_AUTH_SCOPES],
          ],
        );
        const user = await manager.getRepository(User).findOne({
          lock: { mode: 'pessimistic_write' },
          where: { email: input.email },
        });

        return user ? this.issueIfEligible(manager, user) : null;
      },
    );
  }

  /** Evaluates durable cooldown in SQL and retires every current row, including expired tokens. */
  private async issueIfEligible(
    manager: EntityManager,
    user: User,
  ): Promise<null | RegistrationMailWork> {
    if (user.emailVerifiedAt) {
      return null;
    }

    const eligibility: unknown = await manager.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM email_verification_token
         WHERE user_id = $1 AND created_at > clock_timestamp() - ($2::double precision * interval '1 millisecond')
       ) AS eligible`,
      [user.id, this.cooldownMs],
    );

    if (
      !Array.isArray(eligibility) ||
      eligibility.length !== 1 ||
      !isEligibilityRow(eligibility[0])
    ) {
      throw new Error('Invalid registration cooldown response');
    }

    if (!eligibility[0].eligible) {
      return null;
    }

    const issued = this.tokens.issue(OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);
    await manager
      .getRepository(EmailVerificationToken)
      .createQueryBuilder()
      .update()
      .set({ invalidatedAt: databaseNow })
      .where({ invalidatedAt: IsNull(), usedAt: IsNull(), userId: user.id })
      .execute();
    await manager
      .getRepository(EmailVerificationToken)
      .createQueryBuilder()
      .insert()
      .values({
        createdAt: databaseIssuanceTime,
        expiresAt: databaseExpiry,
        id: issued.id,
        invalidatedAt: null,
        tokenDigest: issued.digest,
        usedAt: null,
        userId: user.id,
      })
      .setParameter('ttlMs', this.ttlMs)
      .execute();

    return { rawToken: issued.rawToken, to: user.email };
  }

  /** Returns the same bounded rejection for every invalid confirmation outcome. */
  private rejectConfirmation(): never {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.CONFIRMATION_INVALID,
      'Email confirmation is invalid',
    );
  }

  /** Applies bounded lock waits and maps only known database outages; integrity failures roll back unchanged. */
  private async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(
        /** Shares the existing session lock-timeout policy without introducing a transaction framework. */
        async (manager) => {
          await manager.query("SELECT set_config('lock_timeout', $1, true)", [
            `${AUTH_LOCK_TIMEOUT_MS}ms`,
          ]);
          return work(manager);
        },
      );
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
}

/** Keeps expiry arithmetic in PostgreSQL with the validated TTL bound as a query parameter. */
function databaseExpiry(): string {
  return "statement_timestamp() + (:ttlMs::double precision * interval '1 millisecond')";
}

/** Anchors creation and expiry to the same insert-statement time, after acquiring the user lock. */
function databaseIssuanceTime(): string {
  return 'statement_timestamp()';
}

/** Defers persisted timestamps to PostgreSQL instead of truncating them through JavaScript dates. */
function databaseNow(): string {
  return 'clock_timestamp()';
}

/** Narrows the fixed cooldown query without trusting arbitrary query results. */
function isEligibilityRow(value: unknown): value is { eligible: boolean } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'eligible' in value &&
    typeof value.eligible === 'boolean'
  );
}
