import { ApolloProvider } from '@apollo/client/react';
import { type PropsWithChildren, useState } from 'react';

import { createGraphqlClient } from '../graphql/runtime/createGraphqlClient';

/** Owns one cookie-credentialed Apollo client for the current browser tab. */
export function ApolloAppProvider({ children }: PropsWithChildren) {
  const [graphqlClient] = useState(createGraphqlClient);

  return <ApolloProvider client={graphqlClient}>{children}</ApolloProvider>;
}
