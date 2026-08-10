import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

import { ROLES_KEY } from '../decorators';
import { RequestWithUser } from '../types/auth-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = getRequest(context);
    const user = request.user;
    const hasRequiredRole = requiredRoles.some((role) => user?.roles?.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role');
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
