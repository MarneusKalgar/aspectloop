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
  graphql.mutation('SignUp', ({ variables }) => {
    const input = variables.input as {
      displayName: string;
      email: string;
      password: string;
    };

    const existingUser = findMockUserByEmail(input.email);

    if (existingUser) {
      return HttpResponse.json({
        errors: [{ message: 'User with this email already exists' }],
      });
    }

    const user = createMockUser(input);

    return HttpResponse.json({
      data: {
        signUp: {
          success: true,
          user: toMockPublicUser(user),
        },
      },
    });
  }),
  graphql.mutation('SignIn', ({ variables }) => {
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

    setMockSessionUser(user.id);

    return HttpResponse.json({
      data: {
        signIn: {
          user: toMockPublicUser(user),
        },
      },
    });
  }),
  graphql.mutation('SignOut', () => {
    clearMockSessionUser();

    return HttpResponse.json({
      data: {
        signOut: {
          success: true,
        },
      },
    });
  }),
  graphql.query('Me', () => {
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
  }),
  graphql.query('CorrectionSessions', () => {
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
  }),
  graphql.query('CorrectionSession', ({ variables }) => {
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
  }),
];
