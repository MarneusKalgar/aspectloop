import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

import type { BrowserSessionGraphqlContext } from '#app/graphql/browser-session-context';

import { PUBLIC_BROWSER_SESSION_KEY } from '../decorators/public-browser-session.decorator';
import {
  BrowserSessionAuthenticationService,
  type BrowserSessionRequest,
} from '../session/browser-session-authentication.service';

/** Fail-closed global guard for the active browser-session boundary. */
@Injectable()
export class BrowserSessionGuard implements CanActivate {
  /** Receives public metadata and request-scoped authentication. */
  constructor(
    private readonly reflector: Reflector,
    private readonly authentication: BrowserSessionAuthenticationService,
  ) {}

  /** Requires a session by default; only marked handlers are public. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_BROWSER_SESSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (context.getType<GqlContextType>() === 'graphql') {
      const graphql =
        GqlExecutionContext.create(context).getContext<BrowserSessionGraphqlContext>();

      if (!graphql?.browserSession || !graphql.req) {
        throw new InternalServerErrorException('Browser session context is unavailable');
      }

      await this.authentication.validate(graphql.req, graphql.browserSession);
      return true;
    }

    const request = context.switchToHttp().getRequest<BrowserSessionRequest>();
    await this.authentication.validate(request, { recordActivity: false });
    return true;
  }
}
