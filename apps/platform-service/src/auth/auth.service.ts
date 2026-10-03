import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutRequest,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformSignInRequest,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  platformBrowserSessionSignInResponseSchema,
  platformBrowserSessionSignOutResponseSchema,
  platformBrowserSessionValidationResponseSchema,
  platformSignUpResponseSchema,
} from '@aspectloop/contracts/platform';
import { ConflictException, Injectable, Logger } from '@nestjs/common';

import type { User } from '../users/user.entity';

import { toPlatformUserView } from '../users/user-view';
import { UsersService } from '../users/users.service';
import { PasswordService } from './credentials/password.service';
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

  /** Creates an unverified reviewer account without altering exact password bytes. */
  async signUp(input: PlatformSignUpRequest): Promise<PlatformSignUpResponse> {
    const { displayName, email, password } = input;

    if (await this.usersService.findByEmail(email)) {
      this.logger.warn({
        event: 'auth.sign_up.failed',
        outcome: 'failure',
        reason: 'identity_conflict',
      });
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.usersService.createUser({ displayName, email, passwordHash });

    this.logger.log({ event: 'auth.sign_up.succeeded', outcome: 'success', userId: user.id });

    return platformSignUpResponseSchema.parse({
      success: true,
      user: toPlatformUserView(user),
    });
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

  /** Applies uniform password work and verified-identity policy to browser sign-in. */
  private async authenticateVerifiedUser(input: PlatformSignInRequest): Promise<User> {
    let user: null | User;

    try {
      user = await this.usersService.findByEmailWithPassword(input.email);
    } catch (error) {
      if (isAuthDatabaseUnavailableError(error)) {
        throw new PlatformAuthException(
          AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
          'Authentication dependency is unavailable',
        );
      }

      throw error;
    }

    const isPasswordValid = await this.passwordService.verifyOrDummy(
      input.password,
      user?.passwordHash ?? null,
    );

    if (!user?.passwordHash || !isPasswordValid) {
      this.rejectInvalidCredentials();
    }

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
