import type { SessionCoordinator } from '@app/auth/session-coordination/session-coordinator';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { env } from '@app/config/env';

import { createSessionFenceLink } from './session-fence-link';

/** Sends every GraphQL operation with the browser-managed session cookie. */
export function createGraphqlClient(coordinator: SessionCoordinator) {
  const graphqlUri = env.mockGraphqlRuntime ? '/graphql' : `${env.apiUrl}/graphql`;

  const httpLink = new HttpLink({
    credentials: 'include',
    uri: graphqlUri,
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: createSessionFenceLink(coordinator).concat(httpLink),
    queryDeduplication: false,
  });
}
