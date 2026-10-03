import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutRequest,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformSignInRequest,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformBrowserSessionSignOutRequestSchema,
  platformBrowserSessionValidationRequestSchema,
  platformSignInRequestSchema,
  platformSignUpRequestSchema,
} from '@aspectloop/contracts/platform';
import { Body, Controller, Post } from '@nestjs/common';

import { parsePlatformRequest } from '../internal/parse-platform-request';
import { AuthService } from './auth.service';

/** Accepts only validated gateway-to-Platform authentication commands. */
@Controller(`${PLATFORM_INTERNAL_API_PREFIX.slice(1)}/auth`)
export class AuthController {
  /** Creates the internal authentication transport boundary. */
  constructor(private readonly authService: AuthService) {}

  /** Validates credentials and issues one opaque browser session. */
  @Post('sign-in')
  signIn(@Body() body: unknown): Promise<PlatformBrowserSessionSignInResponse> {
    const request: PlatformSignInRequest = parsePlatformRequest(platformSignInRequestSchema, body);

    return this.authService.signInBrowserSession(request);
  }

  /** Revokes only the family proven by the supplied opaque credential. */
  @Post('sign-out')
  signOut(@Body() body: unknown): Promise<PlatformBrowserSessionSignOutResponse> {
    const request: PlatformBrowserSessionSignOutRequest = parsePlatformRequest(
      platformBrowserSessionSignOutRequestSchema,
      body,
    );

    return this.authService.signOutBrowserSession(request);
  }

  /** Validates and delegates one account-creation command. */
  @Post('sign-up')
  signUp(@Body() body: unknown): Promise<PlatformSignUpResponse> {
    const request: PlatformSignUpRequest = parsePlatformRequest(platformSignUpRequestSchema, body);

    return this.authService.signUp(request);
  }

  /** Validates current browser-session state and optionally records activity. */
  @Post('session/validate')
  validateSession(@Body() body: unknown): Promise<PlatformBrowserSessionValidationResponse> {
    const request: PlatformBrowserSessionValidationRequest = parsePlatformRequest(
      platformBrowserSessionValidationRequestSchema,
      body,
    );

    return this.authService.validateBrowserSession(request);
  }
}
