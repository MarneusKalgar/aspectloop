import type {
  PlatformMeRequest,
  PlatformMeResponse,
  PlatformRefreshSessionRequest,
  PlatformRefreshSessionResponse,
  PlatformSessionSignInResponse,
  PlatformSessionSignOutRequest,
  PlatformSignInRequest,
  PlatformSignOutResponse,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformMeRequestSchema,
  platformRefreshSessionRequestSchema,
  platformSessionSignOutRequestSchema,
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

  /** Validates bearer claims and resolves current authoritative user state. */
  @Post('me')
  me(@Body() body: unknown): Promise<PlatformMeResponse> {
    const request: PlatformMeRequest = parsePlatformRequest(platformMeRequestSchema, body);

    return this.authService.me(request);
  }

  /** Validates and delegates one refresh-token rotation command. */
  @Post('refresh')
  refresh(@Body() body: unknown): Promise<PlatformRefreshSessionResponse> {
    const request: PlatformRefreshSessionRequest = parsePlatformRequest(
      platformRefreshSessionRequestSchema,
      body,
    );

    return this.authService.refresh(request);
  }

  /** Validates and delegates one sign-in command. */
  @Post('sign-in')
  signIn(@Body() body: unknown): Promise<PlatformSessionSignInResponse> {
    const request: PlatformSignInRequest = parsePlatformRequest(platformSignInRequestSchema, body);

    return this.authService.signIn(request);
  }

  /** Validates and delegates one idempotent refresh-family revocation command. */
  @Post('sign-out')
  signOut(@Body() body: unknown): Promise<PlatformSignOutResponse> {
    const request: PlatformSessionSignOutRequest = parsePlatformRequest(
      platformSessionSignOutRequestSchema,
      body,
    );

    return this.authService.signOut(request);
  }

  /** Validates and delegates one account-creation command. */
  @Post('sign-up')
  signUp(@Body() body: unknown): Promise<PlatformSignUpResponse> {
    const request: PlatformSignUpRequest = parsePlatformRequest(platformSignUpRequestSchema, body);

    return this.authService.signUp(request);
  }
}
