import { useMutation } from '@apollo/client/react';

import type { SignOutMutation } from '../../../generated/graphql';
import type { GraphqlMutationStateWithoutVariables } from '../../types';

import { graphql } from '../../../generated';
import { getOperationErrorMessage } from '../../../utils/getOperationErrorMessage';

const signOutMutationDocument = graphql(`
  mutation SignOut {
    signOut {
      success
    }
  }
`);

/**
 * Executes the sign-out operation and exposes its UI-oriented mutation state.
 *
 * @returns The current sign-out result, error, loading state, and executor.
 */
export function useSignOutMutation(): GraphqlMutationStateWithoutVariables<
  SignOutMutation['signOut']
> {
  const [runSignOutMutation, { data, error, loading }] = useMutation(signOutMutationDocument);

  return {
    data: data?.signOut ?? null,
    error: getOperationErrorMessage(error),
    /**
     * Executes the sign-out mutation without variables.
     *
     * @returns The sign-out payload when the mutation succeeds.
     */
    execute: async (): Promise<null | SignOutMutation['signOut']> => {
      const result = await runSignOutMutation();

      return result.data?.signOut ?? null;
    },
    loading,
  };
}
