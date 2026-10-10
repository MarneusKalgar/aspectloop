import { App } from '@app/App';
import { findMockUserByEmail } from '@app/mocks/data';
import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

/** Exercises generic signup acceptance through the actual app and typed mock boundary. */
describe('sign-up integration', () => {
  /** Keeps duplicate registration neutral and preserves the verified reviewer profile. */
  it('acknowledges duplicate registration without disclosing existence or changing its profile', async () => {
    const user = userEvent.setup();
    const original = findMockUserByEmail(defaultMockReviewerCredentials.email);

    render(<App />);

    const submitButton = await screen.findByTestId('signup-link');
    expect(submitButton).toBeInTheDocument();

    await user.click(submitButton);

    const displayNameInput = await screen.findByRole('textbox', { name: /^display name/i });
    const emailInput = screen.getByRole('textbox', { name: /^email/i });
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });

    await user.type(displayNameInput, 'Existing Reviewer');
    await user.type(emailInput, defaultMockReviewerCredentials.email);
    await user.type(passwordInput, defaultMockReviewerCredentials.password);
    await user.click(screen.getByTestId('submit-button'));

    expect(
      await screen.findByText('If confirmation is needed, check your email before signing in.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('User with this email already exists')).not.toBeInTheDocument();
    expect(findMockUserByEmail(defaultMockReviewerCredentials.email)).toBe(original);
    expect(original?.displayName).toBe('Correction Tester');
  });
});
