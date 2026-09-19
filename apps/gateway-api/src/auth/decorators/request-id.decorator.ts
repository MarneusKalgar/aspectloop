import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

interface RequestWithId {
  id?: unknown;
}

/** Reads the logger-assigned request ID from either GraphQL or HTTP transport context. */
export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = getRequest(context);

    return typeof request?.id === 'string' ? request.id : undefined;
  },
);

/** Resolves the underlying request without coupling callers to one Nest transport. */
function getRequest(context: ExecutionContext): RequestWithId | undefined {
  if (context.getType<string>() === 'http') {
    return context.switchToHttp().getRequest<RequestWithId>();
  }

  return GqlExecutionContext.create(context).getContext<{ req?: RequestWithId }>().req;
}
