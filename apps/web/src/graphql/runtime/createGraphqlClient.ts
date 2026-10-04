import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { env } from '@app/config/env';

/** Sends every GraphQL operation with the browser-managed session cookie. */
export function createGraphqlClient() {
  const graphqlUri = env.mockGraphqlRuntime ? '/graphql' : `${env.apiUrl}/graphql`;

  const httpLink = new HttpLink({
    credentials: 'include',
    uri: graphqlUri,
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: httpLink,
  });
}
