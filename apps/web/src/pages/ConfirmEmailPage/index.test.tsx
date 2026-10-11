import { initializeConfirmationAttempt } from '@app/auth/email-confirmation/confirmation-attempt';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmEmailPage } from './index';

const { confirm } = vi.hoisted(
  /** Supplies only a local mock executor, not a production secret. */ () => ({ confirm: vi.fn() }),
);
vi.mock(
  '@app/graphql/hooks/auth/mutations/useEmailConfirmation',
  /** Isolates accessible page interaction from the integration transport. */ () => ({
    useEmailConfirmation: /** Supplies only the local executor. */ () => ({ confirm }),
  }),
);

describe('ConfirmEmailPage', /** Groups accessible explicit-action and invalid-link presentation. */ () => {
  /** Mounting renders an explicit action and safe copy, not an automatic mutation. */
  it('confirms only after a click and removes the terminal action', async () => {
    confirm.mockResolvedValue(undefined);
    initializeConfirmationAttempt('fixture-token');
    renderWithProviders(<ConfirmEmailPage />);
    expect(confirm).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Email confirmed\. Sign in/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm email' })).not.toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  /** Absence shares invalid-link guidance and never discloses why a token is unavailable. */
  it('offers fixed resend and sign-in navigation without an absent-token request', () => {
    initializeConfirmationAttempt(null);
    renderWithProviders(<ConfirmEmailPage />);
    expect(screen.getByText(/This link is unavailable/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Request another confirmation email' }),
    ).toHaveAttribute('href', '/registration-pending');
    expect(screen.queryByRole('button', { name: 'Confirm email' })).not.toBeInTheDocument();
  });
});
