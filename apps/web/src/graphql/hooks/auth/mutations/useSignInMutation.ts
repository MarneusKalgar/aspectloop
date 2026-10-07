import type { SignInInput, SignInMutation } from '@app/graphql/generated/graphql';

import { useApolloClient } from '@apollo/client/react';
import { graphql } from '@app/graphql/generated';
import { useCallback } from 'react';

const signInMutationDocument = graphql(`
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      user {
        id
        email
        displayName
        roles
        scopes
        createdAt
        updatedAt
      }
    }
  }
`);

/** Supplies an uncached executor; only the locked coordinator consumes cookie-action results. */
export function useSignInMutation() {
  const client = useApolloClient();
  return useCallback(
    /** Does not publish credential-action data into hook state or normalized cache. */
    async (input: SignInInput, signal: AbortSignal): Promise<null | SignInMutation['signIn']> => {
      const result = await client.mutate({
        context: { fetchOptions: { signal }, sessionCookieAction: true },
        fetchPolicy: 'no-cache',
        mutation: signInMutationDocument,
        variables: { input },
      });
      return result.data?.signIn ?? null;
    },
    [client],
  );
}
