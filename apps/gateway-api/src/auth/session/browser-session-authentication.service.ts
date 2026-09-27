import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { UnauthorizedException } from '@nestjs/common';

import { BrowserSessionPlatformClient } from '#app/platform/browser-session-platform-client';
import { PlatformBrowserSessionRejectedException } from '#app/platform/platform.errors';

import type { AuthUser, RequestWithUser } from '../types/auth-user';

import { BrowserSessionCookieAdapter } from './browser-session-cookie.adapter';

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
  private readonly inFlight = new WeakMap<BrowserSessionRequest, Promise<AuthUser>>();

  /** Binds the prepared validator to Platform and the cookie adapter. */
  constructor(
    private readonly platform: BrowserSessionPlatformClient,
    private readonly cookie: BrowserSessionCookieAdapter,
  ) {}

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
    request.user = user;
    return user;
  }

  /** Reads one credential and asks Platform for the current user and expiry. */
  private async validateOnce(
    request: BrowserSessionRequest,
    context: BrowserSessionValidationContext,
  ): Promise<AuthUser> {
    const credential = this.cookie.read(request.headers.cookie);

    if (!credential) {
      throw new UnauthorizedException('Browser session is invalid');
    }

    try {
      const session = await this.platform.validate(
        {
          recordActivity: context.recordActivity,
          sessionCredential: credential,
        },
        { requestId: typeof request.id === 'string' ? request.id : undefined },
      );
      const user: AuthUser = {
        displayName: session.user.displayName,
        email: session.user.email,
        roles: session.user.roles,
        scopes: session.user.scopes,
        sub: session.user.id,
      };

      request.log?.setBindings?.({ userId: user.sub });
      return user;
    } catch (error) {
      if (
        error instanceof PlatformBrowserSessionRejectedException &&
        error.code === AUTH_ERROR_CODE.SESSION_INVALID
      ) {
        throw new UnauthorizedException('Browser session is invalid');
      }

      throw error;
    }
  }
}
