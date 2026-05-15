import { useMutation } from '@apollo/client/react';

import type {
  SignInInput,
  SignInMutation,
  SignInMutationVariables,
  SignOutMutation,
  SignOutMutationVariables,
  SignUpInput,
  SignUpMutation,
  SignUpMutationVariables,
} from '../../gql/graphql';
import type { GraphqlMutationState, GraphqlMutationStateWithoutVariables } from './types';

import { graphql } from '../../gql';
import { getOperationErrorMessage } from '../utils/getOperationErrorMessage';

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

const signOutMutationDocument = graphql(`
  mutation SignOut {
    signOut {
      success
    }
  }
`);

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

export function useSignInMutation(): GraphqlMutationState<SignInMutation['signIn'], SignInInput> {
  const [runSignInMutation, { data, error, loading }] = useMutation<
    SignInMutation,
    SignInMutationVariables
  >(signInMutationDocument);

  return {
    data: data?.signIn ?? null,
    error: getOperationErrorMessage(error),
    execute: async (input: SignInInput): Promise<null | SignInMutation['signIn']> => {
      const result = await runSignInMutation({
        variables: { input },
      });

      return result.data?.signIn ?? null;
    },
    loading,
  };
}

export function useSignOutMutation(): GraphqlMutationStateWithoutVariables<
  SignOutMutation['signOut']
> {
  const [runSignOutMutation, { data, error, loading }] = useMutation<
    SignOutMutation,
    SignOutMutationVariables
  >(signOutMutationDocument);

  return {
    data: data?.signOut ?? null,
    error: getOperationErrorMessage(error),
    execute: async (): Promise<null | SignOutMutation['signOut']> => {
      const result = await runSignOutMutation();

      return result.data?.signOut ?? null;
    },
    loading,
  };
}

export function useSignUpMutation(): GraphqlMutationState<SignUpMutation['signUp'], SignUpInput> {
  const [runSignUpMutation, { data, error, loading }] = useMutation<
    SignUpMutation,
    SignUpMutationVariables
  >(signUpMutationDocument);

  return {
    data: data?.signUp ?? null,
    error: getOperationErrorMessage(error),
    execute: async (input: SignUpInput): Promise<null | SignUpMutation['signUp']> => {
      const result = await runSignUpMutation({
        variables: { input },
      });

      return result.data?.signUp ?? null;
    },
    loading,
  };
}
