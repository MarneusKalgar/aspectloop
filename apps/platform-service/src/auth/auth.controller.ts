import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutRequest,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformConfirmEmailResponse,
  PlatformPendingSignUpResponse,
  PlatformResendEmailConfirmationResponse,
  PlatformSignInRequest,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformBrowserSessionSignOutRequestSchema,
  platformBrowserSessionValidationRequestSchema,
  platformSignInRequestSchema,
} from '@aspectloop/contracts/platform';
import { Body, Controller, Post } from '@nestjs/common';

import { parsePlatformRequest } from '../internal/parse-platform-request';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration/registration.service';

/** Accepts only validated gateway-to-Platform authentication commands. */
@Controller(`${PLATFORM_INTERNAL_API_PREFIX.slice(1)}/auth`)
export class AuthController {
  /** Creates the internal authentication transport boundary. */
  constructor(
    private readonly authService: AuthService,
    private readonly registration: RegistrationService,
  ) {}

  /** Consumes an explicit token using D2's uniform token and structural validation. */
  @Post('confirm-email')
  confirmEmail(@Body() body: unknown): Promise<PlatformConfirmEmailResponse> {
    return this.registration.confirm(body);
  }

  /** Acknowledges resend generically without exposing identity or delivery state. */
  @Post('resend-email-confirmation')
  resendEmailConfirmation(@Body() body: unknown): Promise<PlatformResendEmailConfirmationResponse> {
    return this.registration.resend(body);
  }

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

  /** Activates validated generic registration without issuing a session. */
  @Post('sign-up')
  signUp(@Body() body: unknown): Promise<PlatformPendingSignUpResponse> {
    return this.registration.signUp(body);
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
