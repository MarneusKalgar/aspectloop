import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { StringValue } from 'ms';

import { UsersModule } from '../users/users.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  exports: [
    AuthService,
    GqlJwtAuthGuard,
    JwtAuthGuard,
    JwtModule,
    RolesGuard,
    ScopesGuard,
    TokenService,
  ],
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = (configService.get<string>('JWT_ACCESS_TTL') ?? '15m') as StringValue;

        return {
          secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  providers: [
    AuthResolver,
    AuthService,
    GqlJwtAuthGuard,
    JwtAuthGuard,
    JwtStrategy,
    PasswordService,
    RolesGuard,
    ScopesGuard,
    TokenService,
  ],
})
export class AuthModule {}
