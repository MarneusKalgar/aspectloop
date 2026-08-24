import { HttpException, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';

const expectedStatusCodes = new Map<number, string>([
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHENTICATED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
]);
const logger = new Logger('GraphQL');

/**
 * Converts resolver failures into the stable GraphQL error contract.
 *
 * @param error The error produced by GraphQL execution or a Nest resolver.
 * @returns A safe GraphQL error for the client.
 */
export function maskGraphqlError(error: unknown): Error {
  const httpException = findHttpException(error);

  if (httpException && httpException.getStatus() >= 400 && httpException.getStatus() < 500) {
    return createExpectedError(error, httpException);
  }

  if (error instanceof GraphQLError && !error.originalError) {
    return error;
  }

  logger.error({
    errorType: getErrorType(error),
    event: 'graphql.operation.failed',
    outcome: 'failure',
  });

  return new GraphQLError('Unexpected error.', {
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
}

/**
 * Converts an expected Nest HTTP exception into a client-visible GraphQL error.
 *
 * @param error The original GraphQL execution error, when available.
 * @param exception The expected Nest HTTP exception to expose.
 * @returns A GraphQL error with a stable extension code and safe message.
 */
function createExpectedError(error: unknown, exception: HttpException): GraphQLError {
  const graphQLError = error instanceof GraphQLError ? error : undefined;

  return new GraphQLError(getExceptionMessage(exception), {
    extensions: {
      code: expectedStatusCodes.get(exception.getStatus()) ?? 'BAD_REQUEST',
    },
    path: graphQLError?.path,
  });
}

/**
 * Finds a Nest HTTP exception wrapped by GraphQL execution.
 *
 * @param error The GraphQL execution error to inspect.
 * @returns The wrapped HTTP exception, when the failure represents one.
 */
function findHttpException(error: unknown): HttpException | undefined {
  let currentError = error;
  const visited = new Set<unknown>();

  while (currentError && !visited.has(currentError)) {
    if (currentError instanceof HttpException) {
      return currentError;
    }

    visited.add(currentError);

    if (currentError instanceof GraphQLError) {
      currentError = currentError.originalError;
      continue;
    }

    currentError = undefined;
  }

  return undefined;
}

/**
 * Extracts only a bounded error category for internal diagnostics.
 *
 * @param error GraphQL or resolver error to classify.
 * @returns A safe error class name without message, stack, or source document.
 */
function getErrorType(error: unknown): string {
  const candidate = error instanceof GraphQLError ? error.originalError : error;
  const name = candidate instanceof Error ? candidate.name : 'UnknownError';

  return /^[_A-Za-z][_0-9A-Za-z]{0,63}$/.test(name) ? name : 'UnknownError';
}

/**
 * Extracts the safe public message from a Nest HTTP exception response.
 *
 * @param exception The expected Nest HTTP exception.
 * @returns A string suitable for the GraphQL client error message.
 */
function getExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  if (isRecord(response)) {
    const message = response.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(', ');
    }
  }

  return exception.message;
}

/**
 * Narrows an unknown value to a plain object-like record.
 *
 * @param value The value to inspect.
 * @returns Whether the value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
