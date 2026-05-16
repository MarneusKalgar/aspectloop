import { ApolloProvider } from '@apollo/client/react';
import { type PropsWithChildren, useRef, useState } from 'react';

import { useAccessTokenCookie } from '../auth/useAccessTokenCookie';
import { createGraphqlClient } from '../graphql/runtime/createGraphqlClient';

export function ApolloAppProvider({ children }: PropsWithChildren) {
  const { accessToken } = useAccessTokenCookie();
  const accessTokenRef = useRef<null | string>(accessToken);
  accessTokenRef.current = accessToken;

  const [graphqlClient] = useState(() =>
    createGraphqlClient({
      getAccessToken: () => accessTokenRef.current,
    }),
  );

  return <ApolloProvider client={graphqlClient}>{children}</ApolloProvider>;
}
