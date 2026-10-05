import { ApolloProvider } from '@apollo/client/react';
import { type PropsWithChildren, useRef } from 'react';

import { useSessionCoordinator } from '../auth/session-coordination/SessionCoordinatorProvider';
import { createGraphqlClient } from '../graphql/runtime/createGraphqlClient';

/** Owns one cookie-credentialed Apollo client for the current browser tab. */
export function ApolloAppProvider({ children }: PropsWithChildren) {
  const coordinator = useSessionCoordinator();
  const instance = useRef<null | ReturnType<typeof createGraphqlClient>>(null);
  instance.current ??= createGraphqlClient(coordinator);
  const graphqlClient = instance.current;

  return <ApolloProvider client={graphqlClient}>{children}</ApolloProvider>;
}
