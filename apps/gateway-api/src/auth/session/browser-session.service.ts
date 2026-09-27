import type { PlatformSignInRequest, PlatformUserView } from '@aspectloop/contracts/platform';

import type { PlatformRequestContext } from '#app/platform/platform-http-transport';

import { BrowserSessionPlatformClient } from '#app/platform/browser-session-platform-client';

import {
  BrowserSessionCookieAdapter,
  type SessionCookieResponse,
} from './browser-session-cookie.adapter';

/** Coordinates prepared sign-in and sign-out with Gateway-owned cookie effects. */
export class BrowserSessionService {
  /** Keeps cookie ownership at the Gateway boundary. */
  constructor(
    private readonly platform: BrowserSessionPlatformClient,
    private readonly cookie: BrowserSessionCookieAdapter,
  ) {}

  /** A failed Platform call never writes over an existing browser credential. */
  async signIn(
    input: PlatformSignInRequest,
    response: SessionCookieResponse,
    context: PlatformRequestContext = {},
  ): Promise<PlatformUserView> {
    const session = await this.platform.signIn(input, context);
    this.cookie.set(response, session.sessionCredential, session.sessionExpiresAt);
    return session.user;
  }

  /** Always clears the browser credential, even when revocation is unconfirmed. */
  async signOut(
    cookieHeader: unknown,
    response: SessionCookieResponse,
    context: PlatformRequestContext = {},
  ): Promise<void> {
    const credential = this.cookie.read(cookieHeader);

    try {
      if (credential) {
        await this.platform.signOut(credential, context);
      }
    } finally {
      this.cookie.clear(response);
    }
  }
}
