import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { PlatformModule } from '../platform/platform.module';
import { AuthResolver } from './auth.resolver';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  exports: [GqlJwtAuthGuard, JwtAuthGuard, RolesGuard, ScopesGuard],
  imports: [PlatformModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AuthResolver, GqlJwtAuthGuard, JwtAuthGuard, JwtStrategy, RolesGuard, ScopesGuard],
})
export class AuthModule {}
