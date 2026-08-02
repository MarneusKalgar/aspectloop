import { useMutation } from '@apollo/client/react';

import type { SignUpInput, SignUpMutation } from '../../../generated/graphql';
import type { GraphqlMutationState } from '../../types';

import { graphql } from '../../../generated';
import { getOperationErrorMessage } from '../../../utils/getOperationErrorMessage';

const signUpMutationDocument = graphql(`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      success
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
 * Executes the sign-up operation and exposes its UI-oriented mutation state.
 *
 * @returns The current sign-up result, error, loading state, and executor.
 */
export function useSignUpMutation(): GraphqlMutationState<SignUpMutation['signUp'], SignUpInput> {
  const [runSignUpMutation, { data, error, loading }] = useMutation(signUpMutationDocument);

  return {
    data: data?.signUp ?? null,
    error: getOperationErrorMessage(error),
    /**
     * Executes sign-up with the generated GraphQL input.
     *
     * @param input The registration details submitted by the user.
     * @returns The registration payload when the mutation succeeds.
     */
    execute: async (input: SignUpInput): Promise<null | SignUpMutation['signUp']> => {
      const result = await runSignUpMutation({
        variables: { input },
      });

      return result.data?.signUp ?? null;
    },
    loading,
  };
}
