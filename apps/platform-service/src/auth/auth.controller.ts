import type {
  PlatformSignInRequest,
  PlatformSignInResponse,
  PlatformSignOutRequest,
  PlatformSignOutResponse,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformSignInRequestSchema,
  platformSignOutRequestSchema,
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

  /** Validates and delegates one sign-in command. */
  @Post('sign-in')
  signIn(@Body() body: unknown): Promise<PlatformSignInResponse> {
    const request: PlatformSignInRequest = parsePlatformRequest(platformSignInRequestSchema, body);

    return this.authService.signIn(request);
  }

  /** Validates and delegates one stateless sign-out command. */
  @Post('sign-out')
  signOut(@Body() body: unknown): Promise<PlatformSignOutResponse> {
    const request: PlatformSignOutRequest = parsePlatformRequest(
      platformSignOutRequestSchema,
      body,
    );

    return this.authService.signOut(request.userId);
  }

  /** Validates and delegates one account-creation command. */
  @Post('sign-up')
  signUp(@Body() body: unknown): Promise<PlatformSignUpResponse> {
    const request: PlatformSignUpRequest = parsePlatformRequest(platformSignUpRequestSchema, body);

    return this.authService.signUp(request);
  }
}
