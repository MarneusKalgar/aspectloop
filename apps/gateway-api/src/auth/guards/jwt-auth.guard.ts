import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

import { RequestWithUser } from '../types/auth-user';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = await super.canActivate(context);

    if (canActivate && context.getType<GqlContextType>() === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      const user = request.user;

      if (user?.sub && request.log?.setBindings) {
        request.log.setBindings({ userId: user.sub });
      }
    }

    return canActivate as boolean;
  }
}
