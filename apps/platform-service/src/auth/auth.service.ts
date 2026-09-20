import type {
  PlatformMeRequest,
  PlatformMeResponse,
  PlatformRefreshSessionRequest,
  PlatformRefreshSessionResponse,
  PlatformSessionSignInResponse,
  PlatformSessionSignOutRequest,
  PlatformSignInRequest,
  PlatformSignOutResponse,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  platformMeResponseSchema,
  platformRefreshSessionResponseSchema,
  platformSessionSignInResponseSchema,
  platformSignOutResponseSchema,
  platformSignUpResponseSchema,
} from '@aspectloop/contracts/platform';
import { ConflictException, Injectable, Logger } from '@nestjs/common';

import type { ActiveAuthSession } from './auth-session.types';

import { toPlatformUserView } from '../users/user-view';
import { UsersService } from '../users/users.service';
import { AuthSessionStore } from './auth-session.store';
import { PasswordService } from './password.service';
import { PlatformAuthException } from './platform-auth.exception';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Creates Platform authentication behavior over persisted identity and session state. */
  constructor(
    private readonly authSessionStore: AuthSessionStore,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  /** Resolves authoritative user data only while the persisted bearer session is active. */
  async me(input: PlatformMeRequest): Promise<PlatformMeResponse> {
    const user = await this.authSessionStore.getActiveUser(input.userId, input.sessionId);

    return platformMeResponseSchema.parse({ user: toPlatformUserView(user) });
  }

  /** Rotates a valid refresh token and returns a replacement session credential pair. */
  async refresh(input: PlatformRefreshSessionRequest): Promise<PlatformRefreshSessionResponse> {
    const session = await this.authSessionStore.refresh(input.refreshToken);

    this.logger.log({
      event: 'auth.refresh.succeeded',
      outcome: 'success',
      sessionId: session.sessionId,
      userId: session.user.id,
    });

    return platformRefreshSessionResponseSchema.parse(await this.createSessionResponse(session));
  }

  /** Authenticates one verified reviewer and creates an independent refresh-token family. */
  async signIn(input: PlatformSignInRequest): Promise<PlatformSessionSignInResponse> {
    const { email, password } = input;

    const user = await this.usersService.findByEmailWithPassword(email);
    const isPasswordValid = await this.passwordService.verifyOrDummy(
      password,
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

    const session = await this.authSessionStore.create(user.id);

    this.logger.log({
      event: 'auth.sign_in.succeeded',
      outcome: 'success',
      sessionId: session.sessionId,
      userId: user.id,
    });

    return platformSessionSignInResponseSchema.parse(await this.createSessionResponse(session));
  }

  /** Revokes the family proven by a valid current or historical refresh token. */
  async signOut(input: PlatformSessionSignOutRequest): Promise<PlatformSignOutResponse> {
    await this.authSessionStore.signOut(input.refreshToken);

    this.logger.log({ event: 'auth.sign_out.completed', outcome: 'success' });

    return platformSignOutResponseSchema.parse({ success: true });
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

  /** Projects one persisted family state into the private session transport contract. */
  private async createSessionResponse(session: ActiveAuthSession): Promise<unknown> {
    const accessToken = await this.tokenService.generateAccessToken(
      session.user,
      session.sessionId,
      session.issuedAt,
      session.effectiveExpiresAt,
    );

    return {
      accessToken,
      refreshExpiresAt: session.effectiveExpiresAt.toISOString(),
      refreshToken: session.refreshToken,
      user: toPlatformUserView(session.user),
    };
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
