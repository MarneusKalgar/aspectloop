import { AUTH_ERROR_CODE, platformConfirmEmailRequestSchema } from '@aspectloop/contracts/platform';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { BrowserSessionGraphqlContext } from '#app/graphql/browser-session-context';

import {
  ConfirmEmailInput,
  ResendEmailConfirmationInput,
  SignInInput,
  SignUpInput,
} from '../graphql/generated/graphql.types';
import { PlatformClient } from '../platform/platform-client';
import { RequestId } from './decorators';
import { PublicBrowserSession } from './decorators/public-browser-session.decorator';
import { BrowserSessionAuthenticationService } from './session/browser-session-authentication.service';
import { BrowserSessionException, mapBrowserSessionError } from './session/browser-session.errors';
import { BrowserSessionService } from './session/browser-session.service';

@Resolver()
export class AuthResolver {
  /** Injects session behavior and cookie-neutral registration transport. */
  constructor(
    private readonly platformClient: PlatformClient,
    private readonly sessionService: BrowserSessionService,
    private readonly authentication: BrowserSessionAuthenticationService,
  ) {}

  /** Rejects empty/oversized token strings uniformly before the strict transport parser. */
  @Mutation('confirmEmail')
  @PublicBrowserSession()
  async confirmEmail(@Args('input') input: ConfirmEmailInput, @RequestId() requestId?: string) {
    const parsed = platformConfirmEmailRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new BrowserSessionException(AUTH_ERROR_CODE.CONFIRMATION_INVALID);
    }

    try {
      await this.platformClient.confirmEmail(parsed.data, { requestId });
      return { success: true };
    } catch (error) {
      throw mapBrowserSessionError(error);
    }
  }

  /** Reads the full user from the already-validated request. */
  @Query('me')
  async me(@Context() context: BrowserSessionGraphqlContext) {
    return this.authentication.getValidatedUser(context.req);
  }

  /** Returns only generic resend acceptance, preserving every existing cookie/session. */
  @Mutation('resendEmailConfirmation')
  @PublicBrowserSession()
  async resendEmailConfirmation(
    @Args('input') input: ResendEmailConfirmationInput,
    @RequestId() requestId?: string,
  ) {
    try {
      await this.platformClient.resendEmailConfirmation(input, { requestId });
      return { success: true };
    } catch (error) {
      throw mapBrowserSessionError(error);
    }
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

  /** Projects only generic acceptance; the deprecated user field is always null. */
  @Mutation('signUp')
  @PublicBrowserSession()
  async signUp(@Args('input') input: SignUpInput, @RequestId() requestId?: string) {
    try {
      await this.platformClient.signUp(input, { requestId });
      return { success: true, user: null };
    } catch (error) {
      throw mapBrowserSessionError(error);
    }
  }
}
