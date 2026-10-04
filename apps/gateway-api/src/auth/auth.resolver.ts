import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { BrowserSessionGraphqlContext } from '#app/graphql/browser-session-context';

import { SignInInput, SignUpInput } from '../graphql/generated/graphql.types';
import { PlatformClient } from '../platform/platform-client';
import { RequestId } from './decorators';
import { PublicBrowserSession } from './decorators/public-browser-session.decorator';
import { BrowserSessionAuthenticationService } from './session/browser-session-authentication.service';
import { BrowserSessionService } from './session/browser-session.service';

@Resolver()
export class AuthResolver {
  /** Injects current-session behavior and the retained signup client. */
  constructor(
    private readonly platformClient: PlatformClient,
    private readonly sessionService: BrowserSessionService,
    private readonly authentication: BrowserSessionAuthenticationService,
  ) {}

  /** Reads the full user from the already-validated request. */
  @Query('me')
  async me(@Context() context: BrowserSessionGraphqlContext) {
    return this.authentication.getValidatedUser(context.req);
  }

  /** Sets the host-only cookie after Platform confirms browser sign-in. */
  @Mutation('signIn')
  @PublicBrowserSession()
  async signIn(
    @Args('input') input: SignInInput,
    @Context() context: BrowserSessionGraphqlContext,
    @RequestId() requestId?: string,
  ) {
    const user = await this.sessionService.signIn(input, context.res, { requestId });
    return { user };
  }

  /** Clears the cookie even if Platform cannot confirm revocation. */
  @Mutation('signOut')
  @PublicBrowserSession()
  async signOut(@Context() context: BrowserSessionGraphqlContext, @RequestId() requestId?: string) {
    await this.sessionService.signOut(context.req.headers.cookie, context.res, { requestId });
    return { success: true };
  }

  /** Retains the current signup producer until D3 changes its contract. */
  @Mutation('signUp')
  @PublicBrowserSession()
  async signUp(@Args('input') input: SignUpInput, @RequestId() requestId?: string) {
    return this.platformClient.signUp(input, { requestId });
  }
}
