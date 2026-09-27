import type { PlatformUserView } from '@aspectloop/contracts/platform';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { InternalServerErrorException } from '@nestjs/common';

import { BrowserSessionPlatformClient } from '#app/platform/browser-session-platform-client';

import type { AuthUser, RequestWithUser } from '../types/auth-user';

import { BrowserSessionCookieAdapter } from './browser-session-cookie.adapter';
import { BrowserSessionException, mapBrowserSessionError } from './browser-session.errors';

export interface BrowserSessionRequest extends RequestWithUser {
  headers: { cookie?: unknown };
  id?: unknown;
}

/** Server-derived instruction for one authoritative validation request. */
export interface BrowserSessionValidationContext {
  readonly recordActivity: boolean;
}

/** Authenticates once per HTTP request against authoritative Platform state. */
export class BrowserSessionAuthenticationService {
  private readonly inFlight = new WeakMap<BrowserSessionRequest, Promise<PlatformUserView>>();

  /** Binds authoritative validation to Platform and the cookie adapter. */
  constructor(
    private readonly platform: BrowserSessionPlatformClient,
    private readonly cookie: BrowserSessionCookieAdapter,
  ) {}

  /** Returns the complete user from the already-validated HTTP request. */
  async getValidatedUser(request: BrowserSessionRequest): Promise<PlatformUserView> {
    const validation = this.inFlight.get(request);

    if (!validation) {
      throw new InternalServerErrorException('Browser session validation is unavailable');
    }

    return validation;
  }

  /** Shares the same validation result across protected fields on one request. */
  async validate(
    request: BrowserSessionRequest,
    context: BrowserSessionValidationContext,
  ): Promise<AuthUser> {
    let validation = this.inFlight.get(request);

    if (!validation) {
      validation = this.validateOnce(request, context);
      this.inFlight.set(request, validation);
    }

    const user = await validation;
    const principal: AuthUser = {
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
      scopes: user.scopes,
      sub: user.id,
    };
    request.user = principal;
    return principal;
  }

  /** Reads one credential and asks Platform for the current user and expiry. */
  private async validateOnce(
    request: BrowserSessionRequest,
    context: BrowserSessionValidationContext,
  ): Promise<PlatformUserView> {
    const credential = this.cookie.read(request.headers.cookie);

    if (!credential) {
      throw new BrowserSessionException(AUTH_ERROR_CODE.SESSION_INVALID);
    }

    try {
      const session = await this.platform.validate(
        {
          recordActivity: context.recordActivity,
          sessionCredential: credential,
        },
        { requestId: typeof request.id === 'string' ? request.id : undefined },
      );
      request.log?.setBindings?.({ userId: session.user.id });
      return session.user;
    } catch (error) {
      throw mapBrowserSessionError(error);
    }
  }
}
