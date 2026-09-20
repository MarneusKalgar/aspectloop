import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthSessionStore } from './auth-session.store';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRefreshToken } from './model/auth-refresh-token.entity';
import { AuthSession } from './model/auth-session.entity';
import { EmailVerificationToken } from './model/email-verification-token.entity';
import { OpaqueTokenService } from './opaque-token.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/** Wires Platform-owned identity commands, persisted sessions, and access-token issuance. */
@Module({
  controllers: [AuthController],
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([AuthRefreshToken, AuthSession, EmailVerificationToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [AuthService, AuthSessionStore, OpaqueTokenService, PasswordService, TokenService],
})
export class AuthModule {}
