import type {
  PlatformSignInRequest,
  PlatformSignInResponse,
  PlatformSignOutResponse,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  platformSignInResponseSchema,
  platformSignOutResponseSchema,
  platformSignUpResponseSchema,
} from '@aspectloop/contracts/platform';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { normalizeEmail } from '../core/utils/normalize-email';
import { toPlatformUserView } from '../users/user-view';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Creates Platform authentication behavior over user, password, and token services. */
  constructor(
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  /** Authenticates a reviewer and issues the current stateless access token. */
  async signIn(input: PlatformSignInRequest): Promise<PlatformSignInResponse> {
    const email = normalizeEmail(input.email);
    const password = input.password.trim();

    if (!email || !password) {
      this.logger.warn({
        event: 'auth.sign_in.failed',
        outcome: 'failure',
        reason: 'invalid_input',
      });
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user?.passwordHash) {
      this.logInvalidCredentials();
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logInvalidCredentials();
      throw new UnauthorizedException('Invalid email or password');
    }

    let accessToken: string;

    try {
      accessToken = await this.tokenService.generateAccessToken(user);
    } catch (error) {
      this.logger.error({
        event: 'auth.sign_in.failed',
        outcome: 'failure',
        reason: 'token_generation_failed',
        userId: user.id,
      });
      throw error;
    }

    this.logger.log({
      event: 'auth.sign_in.succeeded',
      outcome: 'success',
      userId: user.id,
    });

    return platformSignInResponseSchema.parse({
      accessToken,
      user: toPlatformUserView(user),
    });
  }

  /** Confirms the subject still exists before recording stateless sign-out. */
  async signOut(userId: string): Promise<PlatformSignOutResponse> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    this.logger.log({
      event: 'auth.sign_out.succeeded',
      outcome: 'success',
      userId: user.id,
    });

    return platformSignOutResponseSchema.parse({ success: true });
  }

  /** Creates a reviewer account without logging supplied identity or credentials. */
  async signUp(input: PlatformSignUpRequest): Promise<PlatformSignUpResponse> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();
    const password = input.password.trim();

    if (!displayName) {
      throw new BadRequestException('Display name is required');
    }

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    if (await this.usersService.findByEmail(email)) {
      this.logger.warn({
        event: 'auth.sign_up.failed',
        outcome: 'failure',
        reason: 'identity_conflict',
      });
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.usersService.createUser({
      displayName,
      email,
      passwordHash,
    });

    this.logger.log({
      event: 'auth.sign_up.succeeded',
      outcome: 'success',
      userId: user.id,
    });

    return platformSignUpResponseSchema.parse({
      success: true,
      user: toPlatformUserView(user),
    });
  }

  /** Emits the shared safe diagnostic for credential mismatch. */
  private logInvalidCredentials(): void {
    this.logger.warn({
      event: 'auth.sign_in.failed',
      outcome: 'failure',
      reason: 'invalid_credentials',
    });
  }
}
