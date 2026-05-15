/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  displayName: string;
  email: string;
  password: string;
};

export type MeQueryVariables = Exact<{ [key: string]: never }>;

export type MeQuery = {
  me: {
    id: string;
    email: string;
    displayName: string;
    roles: Array<string>;
    scopes: Array<string>;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type SignInMutationVariables = Exact<{
  input: SignInInput;
}>;

export type SignInMutation = {
  signIn: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      displayName: string;
      roles: Array<string>;
      scopes: Array<string>;
      createdAt: string;
      updatedAt: string;
    };
  };
};

export type SignOutMutationVariables = Exact<{ [key: string]: never }>;

export type SignOutMutation = { signOut: { success: boolean } };

export type SignUpMutationVariables = Exact<{
  input: SignUpInput;
}>;

export type SignUpMutation = {
  signUp: {
    success: boolean;
    user: {
      id: string;
      email: string;
      displayName: string;
      roles: Array<string>;
      scopes: Array<string>;
      createdAt: string;
      updatedAt: string;
    };
  };
};

export type CorrectionSessionQueryVariables = Exact<{
  sessionId: string | number;
}>;

export type CorrectionSessionQuery = {
  correctionSession: {
    id: string;
    documentId: string;
    documentType: string;
    status: string;
    version: number;
    draftPayload: unknown;
    createdAt: string;
    updatedAt: string;
  };
};

export type CorrectionSessionsQueryVariables = Exact<{ [key: string]: never }>;

export type CorrectionSessionsQuery = {
  correctionSessions: Array<{
    id: string;
    documentId: string;
    documentType: string;
    status: string;
    version: number;
    updatedAt: string;
  }>;
};

export const MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Me' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'roles' } },
                { kind: 'Field', name: { kind: 'Name', value: 'scopes' } },
                { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const SignInDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SignIn' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'SignInInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'signIn' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'accessToken' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'roles' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'scopes' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SignInMutation, SignInMutationVariables>;
export const SignOutDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SignOut' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'signOut' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'success' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SignOutMutation, SignOutMutationVariables>;
export const SignUpDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SignUp' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'SignUpInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'signUp' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'roles' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'scopes' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SignUpMutation, SignUpMutationVariables>;
export const CorrectionSessionDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CorrectionSession' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'sessionId' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'correctionSession' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'sessionId' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'sessionId' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentType' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                { kind: 'Field', name: { kind: 'Name', value: 'draftPayload' } },
                { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CorrectionSessionQuery, CorrectionSessionQueryVariables>;
export const CorrectionSessionsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CorrectionSessions' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'correctionSessions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'documentType' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CorrectionSessionsQuery, CorrectionSessionsQueryVariables>;
