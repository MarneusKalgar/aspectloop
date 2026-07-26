import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { AuthUser, RequestWithUser } from '../types/auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext<{ req?: RequestWithUser }>().req;

    if (!request?.user) {
      throw new UnauthorizedException('Authenticated user is not available');
    }

    return request.user;
  },
);
