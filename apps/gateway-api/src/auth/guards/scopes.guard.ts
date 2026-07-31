import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

import { SCOPES_KEY } from '../decorators';
import { RequestWithUser } from '../types/auth-user';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes?.length) {
      return true;
    }

    const request = getRequest(context);
    const user = request.user;
    const hasRequiredScopes = requiredScopes.every((scope) => user?.scopes?.includes(scope));

    if (!hasRequiredScopes) {
      throw new ForbiddenException('Insufficient scope');
    }

    return true;
  }
}

function getRequest(context: ExecutionContext): RequestWithUser {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: RequestWithUser }>().req;
  }

  return context.switchToHttp().getRequest<RequestWithUser>();
}
