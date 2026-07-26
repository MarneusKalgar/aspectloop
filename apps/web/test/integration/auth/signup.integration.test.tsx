import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../../src/App';

describe('sign-up integration', () => {
  it('surfaces the server error when the email already exists', async () => {
    const user = userEvent.setup();

    render(<App />);

    const submitButton = await screen.findByTestId('signup-link');
    expect(submitButton).toBeInTheDocument();

    await user.click(submitButton);

    const displayNameInput = await screen.findByRole('textbox', { name: /^display name/i });
    const emailInput = screen.getByRole('textbox', { name: /^email/i });
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });

    await user.type(displayNameInput, 'Existing Reviewer');
    await user.type(emailInput, 'reviewer@elemika.io');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByTestId('submit-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User with this email already exists',
    );
  });
});
