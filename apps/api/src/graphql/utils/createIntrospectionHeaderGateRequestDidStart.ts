import type { ApolloDriverConfig } from '@nestjs/apollo';

import { GraphQLError } from 'graphql';

import { isIntrospectionDocument } from './isIntrospectionDocument';

type GraphqlDidResolveOperation = NonNullable<GraphqlRequestListener['didResolveOperation']>;
type GraphqlPlugin = NonNullable<Omit<ApolloDriverConfig, 'driver'>['plugins']>[number];
type GraphqlRequestDidStart = NonNullable<GraphqlPlugin['requestDidStart']>;
type GraphqlRequestListener = Exclude<Awaited<ReturnType<GraphqlRequestDidStart>>, void>;

export const GRAPHQL_SCHEMA_AUTH_HEADER_NAME = 'x-elemika-schema-auth';

export function createIntrospectionHeaderGateRequestDidStart(
  expectedHeaderValue: null | string | undefined,
): GraphqlRequestDidStart | undefined {
  const normalizedExpectedHeaderValue = expectedHeaderValue?.trim() ?? '';

  if (!normalizedExpectedHeaderValue) {
    return undefined;
  }

  const didResolveOperation: GraphqlDidResolveOperation = (
    requestContext: Parameters<GraphqlDidResolveOperation>[0],
  ) => {
    if (!requestContext.document || !isIntrospectionDocument(requestContext.document)) {
      return Promise.resolve();
    }

    const providedHeaderValue =
      requestContext.request.http?.headers.get(GRAPHQL_SCHEMA_AUTH_HEADER_NAME)?.trim() ?? '';

    if (providedHeaderValue === normalizedExpectedHeaderValue) {
      return Promise.resolve();
    }

    return Promise.reject(
      new GraphQLError(
        `GraphQL introspection requires the ${GRAPHQL_SCHEMA_AUTH_HEADER_NAME} header.`,
        {
          extensions: {
            code: 'FORBIDDEN',
          },
        },
      ),
    );
  };

  const requestDidStart: GraphqlRequestDidStart = () => {
    return Promise.resolve({ didResolveOperation });
  };

  return requestDidStart;
}
