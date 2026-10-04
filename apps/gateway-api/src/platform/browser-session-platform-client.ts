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

/** Calls the active browser-session endpoints through the bounded Platform transport. */
@Injectable()
export class BrowserSessionPlatformClient {
  /** Shares the Gateway's existing bounded Platform transport. */
  constructor(private readonly transport: PlatformHttpTransport) {}

  /** Calls the opaque browser sign-in contract. */
  async signIn(
    input: PlatformSignInRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformBrowserSessionSignInResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.browserSessionSignIn, input, context);
  }

  /** Calls the opaque browser sign-out contract. */
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
