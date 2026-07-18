import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAtRoute } from '../../../src/test/renderAppAtRoute';

describe.skip('sign-in integration', () => {
  it('signs the reviewer in and lands on the correction inbox', async () => {
    const user = userEvent.setup();

    renderAppAtRoute('/signin');

    const emailInput = await screen.findByRole('textbox', { name: 'Email' });
    const passwordInput = screen.getByLabelText('Password', { selector: 'input' });

    await user.type(emailInput, 'reviewer@elemika.io');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Correction inbox')).toBeInTheDocument();
  });
});
