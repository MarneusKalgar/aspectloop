import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { normalizeEmail } from '../core/utils/normalize-email';
import {
  AuthPayload,
  SignInInput,
  SignOutPayload,
  SignUpInput,
  SignUpPayload,
} from '../graphql/generated/graphql.types';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthUser } from './types/auth-user';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async getCurrentUser(authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.sub);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return user;
  }

  /**
   * Authenticates a reviewer and emits a success event only after token creation.
   *
   * @param input Sign-in credentials from the GraphQL boundary.
   * @returns The authenticated user and newly generated access token.
   */
  async signIn(input: SignInInput): Promise<AuthPayload> {
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
      this.logger.warn({
        event: 'auth.sign_in.failed',
        outcome: 'failure',
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn({
        event: 'auth.sign_in.failed',
        outcome: 'failure',
        reason: 'invalid_credentials',
      });
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

    return {
      accessToken,
      user,
    };
  }

  /**
   * Records completion of the current stateless sign-out flow.
   *
   * @param authUser Authenticated request identity.
   * @returns A successful sign-out payload.
   */
  async signOut(authUser: AuthUser): Promise<SignOutPayload> {
    const user = await this.getCurrentUser(authUser);

    this.logger.log({
      event: 'auth.sign_out.succeeded',
      outcome: 'success',
      userId: user.id,
    });

    return {
      success: true,
    };
  }

  /**
   * Creates a reviewer account without logging supplied identity or credentials.
   *
   * @param input Registration values from the GraphQL boundary.
   * @returns The created user in the stable sign-up payload.
   */
  async signUp(input: SignUpInput): Promise<SignUpPayload> {
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

    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
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

    return {
      success: true,
      user,
    };
  }
}
