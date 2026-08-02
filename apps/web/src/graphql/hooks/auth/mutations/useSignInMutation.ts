import { useMutation } from '@apollo/client/react';

import type { SignInInput, SignInMutation } from '../../../generated/graphql';
import type { GraphqlMutationState } from '../../types';

import { graphql } from '../../../generated';
import { getOperationErrorMessage } from '../../../utils/getOperationErrorMessage';

const signInMutationDocument = graphql(`
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      accessToken
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

/**
 * Executes the sign-in operation and exposes its UI-oriented mutation state.
 *
 * @returns The current sign-in result, error, loading state, and executor.
 */
export function useSignInMutation(): GraphqlMutationState<SignInMutation['signIn'], SignInInput> {
  const [runSignInMutation, { data, error, loading }] = useMutation(signInMutationDocument);

  return {
    data: data?.signIn ?? null,
    error: getOperationErrorMessage(error),
    /**
     * Executes sign-in with the generated GraphQL input.
     *
     * @param input The credentials submitted by the user.
     * @returns The authenticated payload when the mutation succeeds.
     */
    execute: async (input: SignInInput): Promise<null | SignInMutation['signIn']> => {
      const result = await runSignInMutation({
        variables: { input },
      });

      return result.data?.signIn ?? null;
    },
    loading,
  };
}
