import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { renderAppAtRoute } from '@app/test/renderAppAtRoute';
import { server } from '@app/test/setup';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

describe('sign-in integration', () => {
  it('signs the reviewer in and lands on the correction inbox', async () => {
    const user = userEvent.setup();
    server.use(
      graphql.query('CorrectionSessions', ({ request }) => {
        expect(request.headers.get('authorization')).toBeNull();
        return HttpResponse.json({ data: { correctionSessions: [] } });
      }),
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
  });
});
