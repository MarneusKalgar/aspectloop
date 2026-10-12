import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutRequest,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformSignInRequest,
} from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  platformBrowserSessionSignInResponseSchema,
  platformBrowserSessionSignOutResponseSchema,
  platformBrowserSessionValidationResponseSchema,
  platformSignInRequestSchema,
} from '@aspectloop/contracts/platform';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { User } from '../users/user.entity';

import { toPlatformUserView } from '../users/user-view';
import { UsersService } from '../users/users.service';
import { PasswordService } from './credentials/password.service';
import { AuthIdentityLimiter } from './limits/auth-identity-limiter';
import { SIGN_IN_CHECK_OUTCOME } from './limits/identity-limit.constants';
import { isAuthDatabaseUnavailableError } from './persistence/database.errors';
import { PlatformAuthException } from './platform-auth.exception';
import { AuthSessionStore } from './sessions/auth-session.store';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Creates Platform authentication behavior over persisted identity and session state. */
  constructor(
    private readonly authSessionStore: AuthSessionStore,
    private readonly passwordService: PasswordService,
    private readonly usersService: UsersService,
    private readonly identityLimiter: AuthIdentityLimiter,
  ) {}

  /** Authenticates one verified reviewer and creates an opaque browser session. */
  async signInBrowserSession(
    input: PlatformSignInRequest,
  ): Promise<PlatformBrowserSessionSignInResponse> {
    const user = await this.authenticateVerifiedUser(input);
    const session = await this.authSessionStore.createBrowserSession(user.id);

    this.logger.log({
      event: 'auth.browser_session.sign_in.succeeded',
      outcome: 'success',
      sessionId: session.sessionId,
      userId: user.id,
    });

    return platformBrowserSessionSignInResponseSchema.parse({
      sessionCredential: session.sessionCredential,
      sessionExpiresAt: session.sessionExpiresAt.toISOString(),
      user: toPlatformUserView(session.user),
    });
  }

  /** Revokes the browser session proven by a valid opaque credential. */
  async signOutBrowserSession(
    input: PlatformBrowserSessionSignOutRequest,
  ): Promise<PlatformBrowserSessionSignOutResponse> {
    await this.authSessionStore.signOutBrowserSession(input.sessionCredential);

    this.logger.log({ event: 'auth.browser_session.sign_out.completed', outcome: 'success' });

    return platformBrowserSessionSignOutResponseSchema.parse({ success: true });
  }

  /** Resolves current browser-session identity and optional server-owned activity. */
  async validateBrowserSession(
    input: PlatformBrowserSessionValidationRequest,
  ): Promise<PlatformBrowserSessionValidationResponse> {
    const session = await this.authSessionStore.validateBrowserSession(
      input.sessionCredential,
      input.recordActivity,
    );

    return platformBrowserSessionValidationResponseSchema.parse({
      sessionExpiresAt: session.sessionExpiresAt.toISOString(),
      sessionId: session.sessionId,
      user: toPlatformUserView(session.user),
    });
  }

  /** Reserves bounded work, resets at password success and preserves unverified/outage distinctions. */
  private async authenticateVerifiedUser(input: PlatformSignInRequest): Promise<User> {
    const result = platformSignInRequestSchema.safeParse(input);

    if (!result.success) {
      throw new BadRequestException('Invalid Platform request');
    }

    const parsed = result.data;
    const reservation = this.identityLimiter.reserveSignIn(parsed.email);

    try {
      const user = await this.usersService.findByEmailWithPassword(parsed.email);
      const isPasswordValid = await this.passwordService.verifyOrDummy(
        parsed.password,
        user?.passwordHash ?? null,
      );

      if (!user?.passwordHash || !isPasswordValid) {
        reservation.settle(SIGN_IN_CHECK_OUTCOME.REJECTED);
        this.rejectInvalidCredentials();
      }

      reservation.settle(SIGN_IN_CHECK_OUTCOME.ACCEPTED);

      if (!user.emailVerifiedAt) {
        this.logger.warn({
          event: 'auth.sign_in.failed',
          outcome: 'failure',
          reason: 'email_unverified',
          userId: user.id,
        });
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
          'Email confirmation is required',
        );
      }

      return user;
    } catch (error) {
      if (isAuthDatabaseUnavailableError(error)) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
          'Authentication dependency is unavailable',
        );
      }

      throw error;
    } finally {
      reservation.settle(SIGN_IN_CHECK_OUTCOME.RELEASED);
    }
  }

  /** Emits the shared safe diagnostic and rejects credential mismatch uniformly. */
  private rejectInvalidCredentials(): never {
    this.logger.warn({
      event: 'auth.sign_in.failed',
      outcome: 'failure',
      reason: 'invalid_credentials',
    });
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      'Invalid email or password',
    );
  }
}
