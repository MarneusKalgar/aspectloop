import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SignInInput, SignUpInput } from '../graphql/generated/graphql.types';
import { PlatformClient } from '../platform/platform-client';
import { CurrentUser, RequestId } from './decorators';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { AuthUser } from './types/auth-user';

@Resolver()
export class AuthResolver {
  constructor(private readonly platformClient: PlatformClient) {}

  @Query('me')
  @UseGuards(GqlJwtAuthGuard)
  async me(@CurrentUser() authUser: AuthUser, @RequestId() requestId?: string) {
    const { user } = await this.platformClient.getUser(authUser.sub, { requestId });

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return user;
  }

  @Mutation('signIn')
  async signIn(@Args('input') input: SignInInput, @RequestId() requestId?: string) {
    return this.platformClient.signIn(input, { requestId });
  }

  @Mutation('signOut')
  @UseGuards(GqlJwtAuthGuard)
  async signOut(@CurrentUser() authUser: AuthUser, @RequestId() requestId?: string) {
    return this.platformClient.signOut({ userId: authUser.sub }, { requestId });
  }

  @Mutation('signUp')
  async signUp(@Args('input') input: SignUpInput, @RequestId() requestId?: string) {
    return this.platformClient.signUp(input, { requestId });
  }
}
