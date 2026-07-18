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

    const displayNameInput = await screen.findByTestId('display-name-input');
    const emailInput = await screen.getByTestId('email-input');
    const passwordInput = await screen.getByTestId('password-input');

    await user.type(displayNameInput, 'Existing Reviewer');
    await user.type(emailInput, 'reviewer@elemika.io');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByTestId('submit-button'));

    expect(await screen.findByText('User with this email already exists')).toBeInTheDocument();
  });
});
