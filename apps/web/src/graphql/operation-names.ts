/** Web client document names only; vocabulary does not grant runtime or live-gate permissions. */
export const GRAPHQL_OPERATION_NAME = Object.freeze({
  CONFIRM_EMAIL: 'ConfirmEmail',
  CORRECTION_SESSIONS: 'CorrectionSessions',
  ME: 'Me',
  RESEND_EMAIL_CONFIRMATION: 'ResendEmailConfirmation',
  SIGN_IN: 'SignIn',
  SIGN_OUT: 'SignOut',
  SIGN_UP: 'SignUp',
} as const);

export type GraphqlOperationName =
  (typeof GRAPHQL_OPERATION_NAME)[keyof typeof GRAPHQL_OPERATION_NAME];
