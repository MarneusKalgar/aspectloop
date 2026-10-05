import type { SignOutMutation } from '@app/graphql/generated/graphql';

import { useApolloClient } from '@apollo/client/react';
import { graphql } from '@app/graphql/generated';
import { useCallback } from 'react';

const signOutMutationDocument = graphql(`
  mutation SignOut {
    signOut {
      success
    }
  }
`);

/** Supplies an uncached executor whose completion remains inside the cookie-action lock. */
export function useSignOutMutation() {
  const client = useApolloClient();
  return useCallback(
    /** Never publishes revocation completion into React mutation state. */
    async (signal: AbortSignal): Promise<null | SignOutMutation['signOut']> => {
      const result = await client.mutate({
        context: { fetchOptions: { signal }, sessionCookieAction: true },
        fetchPolicy: 'no-cache',
        mutation: signOutMutationDocument,
      });
      return result.data?.signOut ?? null;
    },
    [client],
  );
}
