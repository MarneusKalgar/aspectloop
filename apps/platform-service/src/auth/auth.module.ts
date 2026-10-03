import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OpaqueTokenService } from './credentials/opaque-token.service';
import { PasswordService } from './credentials/password.service';
import { EmailVerificationToken } from './registration/model/email-verification-token.entity';
import { AuthSessionStore } from './sessions/auth-session.store';
import { AuthSession } from './sessions/model/auth-session.entity';

/** Wires Platform-owned identity commands and persisted browser sessions. */
@Module({
  controllers: [AuthController],
  imports: [UsersModule, TypeOrmModule.forFeature([AuthSession, EmailVerificationToken])],
  providers: [AuthService, AuthSessionStore, OpaqueTokenService, PasswordService],
})
export class AuthModule {}
