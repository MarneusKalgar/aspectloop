import type { MeQuery } from '@app/graphql/generated/graphql';

import { useApolloClient } from '@apollo/client/react';
import { graphql } from '@app/graphql/generated';
import { useCallback } from 'react';

const meQueryDocument = graphql(`
  query Me {
    me {
      id
      email
      displayName
      roles
      scopes
      createdAt
      updatedAt
    }
  }
`);

/** Returns a network-only bootstrap operation with a bounded caller signal. */
export function useMeQuery(): (signal: AbortSignal) => Promise<MeQuery['me']> {
  const client = useApolloClient();

  return useCallback(
    async (signal: AbortSignal): Promise<MeQuery['me']> => {
      const result = await client.query({
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
        query: meQueryDocument,
      });

      if (!result.data) {
        throw new Error('Me query returned no data');
      }

      return result.data.me;
    },
    [client],
  );
}
