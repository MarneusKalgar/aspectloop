import { findMockUserByEmail, toMockPublicUser } from '@app/mocks/data';
import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { renderAppAtRoute } from '@app/test/renderAppAtRoute';
import { server } from '@app/test/setup';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

/** Verifies the mock's public projection excludes private credentials and token fields. */
function testMockPublicProjection(): void {
  const record = findMockUserByEmail(defaultMockReviewerCredentials.email);

  expect(record).toBeDefined();
  if (!record) {
    return;
  }

  const projected = toMockPublicUser(record);
  expect(Object.keys(projected).sort()).toEqual([
    'createdAt',
    'displayName',
    'email',
    'id',
    'roles',
    'scopes',
    'updatedAt',
  ]);
  expect(projected).not.toHaveProperty('password');
  expect(projected).not.toHaveProperty('accessToken');
  expect(projected).not.toHaveProperty('refreshToken');
}

/** Signs in through the mock GraphQL flow without bearer headers or readable cookies. */
async function testReviewerSignIn(): Promise<void> {
  const user = userEvent.setup();
  server.use(
    graphql.query(
      'CorrectionSessions',
      /** Asserts the inbox request has no obsolete Authorization header. */
      ({ request }) => {
        expect(request.headers.get('authorization')).toBeNull();
        return HttpResponse.json({ data: { correctionSessions: [] } });
      },
    ),
  );

  renderAppAtRoute('/signin');

  const emailInput = await screen.findByRole('textbox', { name: 'Email' });
  const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });

  await user.type(emailInput, defaultMockReviewerCredentials.email);
  await user.type(passwordInput, defaultMockReviewerCredentials.password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Correction inbox' }),
  ).toBeInTheDocument();
  expect(document.cookie).not.toContain('aspectloop_session');
  expect(document.cookie).not.toContain('aspectloop_access_token');

  await user.click(screen.getByRole('button', { name: /CT|Correction Tester/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
}

describe('sign-in integration', () => {
  it(
    'projects only generated public user fields from the private mock record',
    testMockPublicProjection,
  );

  it('signs the reviewer in and lands on the correction inbox', testReviewerSignIn);
});
