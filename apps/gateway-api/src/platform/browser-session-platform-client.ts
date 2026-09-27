import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformSignInRequest,
} from '@aspectloop/contracts/platform';

import { Injectable } from '@nestjs/common';

import { PLATFORM_ENDPOINTS } from './platform-endpoints';
import { PlatformHttpTransport, type PlatformRequestContext } from './platform-http-transport';

/** Prepared target-only Platform adapter; the active JWT client is unchanged. */
@Injectable()
export class BrowserSessionPlatformClient {
  /** Shares the existing bounded Platform transport without changing active routes. */
  constructor(private readonly transport: PlatformHttpTransport) {}

  /** Calls the prepared opaque sign-in contract. */
  async signIn(
    input: PlatformSignInRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformBrowserSessionSignInResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.browserSessionSignIn, input, context);
  }

  /** Calls the prepared opaque sign-out contract. */
  async signOut(
    sessionCredential: string,
    context: PlatformRequestContext = {},
  ): Promise<PlatformBrowserSessionSignOutResponse> {
    return this.transport.post(
      PLATFORM_ENDPOINTS.browserSessionSignOut,
      { sessionCredential },
      context,
    );
  }

  /** Validates one opaque credential against authoritative Platform state. */
  async validate(
    input: PlatformBrowserSessionValidationRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformBrowserSessionValidationResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.browserSessionValidate, input, context);
  }
}
