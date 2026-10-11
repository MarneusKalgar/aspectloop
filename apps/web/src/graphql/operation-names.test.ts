import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import {
  ConfirmEmailDocument,
  CorrectionSessionsDocument,
  MeDocument,
  ResendEmailConfirmationDocument,
  SignInDocument,
  SignOutDocument,
  SignUpDocument,
} from './generated/graphql';
import { GRAPHQL_OPERATION_NAME } from './operation-names';

describe('Web operation names', /** Groups vocabulary spelling and generated document alignment. */ () => {
  /** Keeps expected names independent of the runtime policy consumers. */
  it('exposes the frozen client vocabulary', () => {
    expect(Object.isFrozen(GRAPHQL_OPERATION_NAME)).toBe(true);
    expect(GRAPHQL_OPERATION_NAME).toEqual({
      CONFIRM_EMAIL: 'ConfirmEmail',
      CORRECTION_SESSIONS: 'CorrectionSessions',
      ME: 'Me',
      RESEND_EMAIL_CONFIRMATION: 'ResendEmailConfirmation',
      SIGN_IN: 'SignIn',
      SIGN_OUT: 'SignOut',
      SIGN_UP: 'SignUp',
    });
  });

  /** Detects document renames without replacing static GraphQL source or generated artifacts. */
  it('matches the selected operation in each generated document', () => {
    const documents = {
      [GRAPHQL_OPERATION_NAME.CONFIRM_EMAIL]: ConfirmEmailDocument,
      [GRAPHQL_OPERATION_NAME.CORRECTION_SESSIONS]: CorrectionSessionsDocument,
      [GRAPHQL_OPERATION_NAME.ME]: MeDocument,
      [GRAPHQL_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION]: ResendEmailConfirmationDocument,
      [GRAPHQL_OPERATION_NAME.SIGN_IN]: SignInDocument,
      [GRAPHQL_OPERATION_NAME.SIGN_OUT]: SignOutDocument,
      [GRAPHQL_OPERATION_NAME.SIGN_UP]: SignUpDocument,
    };

    for (const [name, document] of Object.entries(documents)) {
      expect(getOperationAST(document)?.name?.value).toBe(name);
    }
  });
});
