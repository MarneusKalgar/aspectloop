import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SignInInput, SignUpInput } from '../graphql/generated/graphql.types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { AuthUser } from './types/auth-user';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Query('me')
  @UseGuards(GqlJwtAuthGuard)
  async me(@CurrentUser() authUser: AuthUser) {
    return this.authService.getCurrentUser(authUser);
  }

  @Mutation('signIn')
  async signIn(@Args('input') input: SignInInput) {
    return this.authService.signIn(input);
  }

  @Mutation('signOut')
  @UseGuards(GqlJwtAuthGuard)
  async signOut(@CurrentUser() authUser: AuthUser) {
    return this.authService.signOut(authUser);
  }

  @Mutation('signUp')
  async signUp(@Args('input') input: SignUpInput) {
    return this.authService.signUp(input);
  }
}
