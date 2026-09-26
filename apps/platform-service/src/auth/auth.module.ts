import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OpaqueTokenService } from './credentials/opaque-token.service';
import { PasswordService } from './credentials/password.service';
import { TokenService } from './legacy/token.service';
import { EmailVerificationToken } from './registration/model/email-verification-token.entity';
import { AuthSessionStore } from './sessions/auth-session.store';
import { AuthRefreshToken } from './sessions/model/auth-refresh-token.entity';
import { AuthSession } from './sessions/model/auth-session.entity';

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
