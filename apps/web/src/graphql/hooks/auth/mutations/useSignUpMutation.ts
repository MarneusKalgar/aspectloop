import type { SignUpInput, SignUpMutation } from '@app/graphql/generated/graphql';
import type { GraphqlMutationState } from '@app/graphql/hooks/types';

import { useMutation } from '@apollo/client/react';
import { graphql } from '@app/graphql/generated';
import { getOperationErrorMessage } from '@app/graphql/utils/getOperationErrorMessage';

const signUpMutationDocument = graphql(`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      success
    }
  }
`);

/**
 * Executes the sign-up operation and exposes its UI-oriented mutation state.
 *
 * @returns The current sign-up result, error, loading state, and executor.
 */
export function useSignUpMutation(): GraphqlMutationState<SignUpMutation['signUp'], SignUpInput> {
  const [runSignUpMutation, { data, error, loading }] = useMutation(signUpMutationDocument, {
    fetchPolicy: 'no-cache',
  });

  return {
    data: data?.signUp ?? null,
    error: getOperationErrorMessage(error),
    /**
     * Executes sign-up with the generated GraphQL input.
     *
     * @param input The registration details submitted by the user.
     * @returns The registration payload when the mutation succeeds.
     */
    execute: async (
      input: SignUpInput,
      signal?: AbortSignal,
    ): Promise<null | SignUpMutation['signUp']> => {
      const result = await runSignUpMutation({
        context: { fetchOptions: { signal } },
        variables: { input },
      });

      return result.data?.signUp ?? null;
    },
    loading,
  };
}
