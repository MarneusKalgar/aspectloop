import { graphql, HttpResponse } from 'msw';

import {
  createMockToken,
  createMockUser,
  findMockUserByEmail,
  findMockUserByToken,
  getMockSession,
  listMockSessions,
} from '../data';

function getAuthorizationToken(request: Request): null | string {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.replace('Bearer ', '').trim();
}

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
          user,
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
        errors: [{ message: 'Invalid email or password' }],
      });
    }

    return HttpResponse.json({
      data: {
        signIn: {
          accessToken: createMockToken(user),
          user,
        },
      },
    });
  }),
  graphql.mutation('SignOut', ({ request }) => {
    const user = findMockUserByToken(getAuthorizationToken(request));

    if (!user) {
      return HttpResponse.json({
        errors: [{ message: 'Unauthenticated' }],
      });
    }

    return HttpResponse.json({
      data: {
        signOut: {
          success: true,
        },
      },
    });
  }),
  graphql.query('Me', ({ request }) => {
    const user = findMockUserByToken(getAuthorizationToken(request));

    return HttpResponse.json({
      data: {
        me: user,
      },
    });
  }),
  graphql.query('CorrectionSessions', ({ request }) => {
    const user = findMockUserByToken(getAuthorizationToken(request));

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
  graphql.query('CorrectionSession', ({ request, variables }) => {
    const user = findMockUserByToken(getAuthorizationToken(request));
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
