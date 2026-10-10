import { graphql, HttpResponse } from 'msw';

import { BROWSER_SESSION_ERROR_CODE } from '../../auth/session-error';
import {
  clearMockSessionUser,
  createMockUser,
  findMockUserByEmail,
  getMockSession,
  getMockSessionUser,
  listMockSessions,
  setMockSessionUser,
  toMockPublicUser,
} from '../data';

export const graphqlHandlers = [
  graphql.mutation(
    'SignUp',
    /** Acknowledges new/duplicate registration generically, retaining unverified state. */ ({
      variables,
    }) => {
      const input = variables.input as {
        displayName: string;
        email: string;
        password: string;
      };

      createMockUser(input);

      return HttpResponse.json({
        data: {
          signUp: {
            success: true,
            user: null,
          },
        },
      });
    },
  ),
  graphql.mutation(
    'SignIn',
    /** Starts a session only for verified credentials; the default reviewer stays verified. */ ({
      variables,
    }) => {
      const input = variables.input as {
        email: string;
        password: string;
      };
      const user = findMockUserByEmail(input.email);

      if (user?.password !== input.password) {
        return HttpResponse.json({
          errors: [
            {
              extensions: { code: BROWSER_SESSION_ERROR_CODE.INVALID_CREDENTIALS },
              message: 'Invalid email or password',
            },
          ],
        });
      }

      if (!user.emailVerified) {
        return HttpResponse.json({
          errors: [
            {
              extensions: { code: BROWSER_SESSION_ERROR_CODE.EMAIL_UNVERIFIED },
              message: 'Email confirmation is required',
            },
          ],
        });
      }

      setMockSessionUser(user.id);

      return HttpResponse.json({
        data: {
          signIn: {
            user: toMockPublicUser(user),
          },
        },
      });
    },
  ),
  graphql.mutation(
    'SignOut',
    /** Ends the in-memory session. */ () => {
      clearMockSessionUser();

      return HttpResponse.json({
        data: {
          signOut: {
            success: true,
          },
        },
      });
    },
  ),
  graphql.query(
    'Me',
    /** Returns the session's public user. */ () => {
      const user = getMockSessionUser();

      if (!user) {
        return HttpResponse.json({
          errors: [
            {
              extensions: { code: BROWSER_SESSION_ERROR_CODE.SESSION_INVALID },
              message: 'Browser session is invalid',
            },
          ],
        });
      }

      return HttpResponse.json({
        data: {
          me: user,
        },
      });
    },
  ),
  graphql.query(
    'CorrectionSessions',
    /** Requires an active session. */ () => {
      const user = getMockSessionUser();

      if (!user) {
        return HttpResponse.json({
          errors: [{ message: 'Unauthenticated' }],
        });
      }

      return HttpResponse.json({
        data: {
          correctionSessions: listMockSessions(),
        },
      });
    },
  ),
  graphql.query(
    'CorrectionSession',
    /** Requires an active session. */ ({ variables }) => {
      const user = getMockSessionUser();
      const session = getMockSession(String(variables.sessionId));

      if (!user) {
        return HttpResponse.json({
          errors: [{ message: 'Unauthenticated' }],
        });
      }

      if (!session) {
        return HttpResponse.json({
          errors: [{ message: 'Correction session not found' }],
        });
      }

      return HttpResponse.json({
        data: {
          correctionSession: {
            ...session,
            createdAt: session.updatedAt,
            draftPayload: {
              header: {
                invoiceDate: '2026-05-01',
                invoiceNumber: 'INV-2026-001',
                supplierName: 'Acme Supplies',
              },
            },
          },
        },
      });
    },
  ),
];
