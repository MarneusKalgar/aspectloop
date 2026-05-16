import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';

import { env } from '../../config/env';

interface CreateGraphqlClientOptions {
  getAccessToken: () => null | string;
}

export function createGraphqlClient({ getAccessToken }: CreateGraphqlClientOptions) {
  const graphqlUri = env.mockGraphqlRuntime ? '/graphql' : `${env.apiUrl}/graphql`;

  const authLink = new SetContextLink(() => {
    const token = getAccessToken();

    if (!token) {
      return {};
    }

    return {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
  });

  const httpLink = new HttpLink({
    uri: graphqlUri,
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authLink.concat(httpLink),
  });
}
