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
} from '../graphql/graphql.types';
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

  async signIn(input: SignInInput): Promise<AuthPayload> {
    const email = normalizeEmail(input.email);
    const password = input.password.trim();

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User signed in: ${user.email}`);

    return {
      accessToken: await this.tokenService.generateAccessToken(user),
      user,
    };
  }

  async signOut(authUser: AuthUser): Promise<SignOutPayload> {
    const user = await this.getCurrentUser(authUser);

    this.logger.log(`User signed out: ${user.email}`);

    return {
      success: true,
    };
  }

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
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.usersService.createUser({
      displayName,
      email,
      passwordHash,
    });

    this.logger.log(`User signed up: ${user.email}`);

    return {
      success: true,
      user,
    };
  }
}
