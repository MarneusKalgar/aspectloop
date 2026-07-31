import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { RequestWithUser } from '../types/auth-user';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class GqlJwtAuthGuard extends JwtAuthGuard {
  getRequest(context: ExecutionContext): RequestWithUser {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext<{ req: RequestWithUser }>().req;
  }
}
