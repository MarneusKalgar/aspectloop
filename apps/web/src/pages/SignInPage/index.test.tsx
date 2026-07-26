import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';
import { SignInPage } from './index';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
  }),
}));

describe('SignInPage', () => {
  it('renders the critical sign-in fields and actions', () => {
    renderWithProviders(<SignInPage />);

    expect(screen.getByText('Review extracted data with evidence at hand')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByText('Test credentials')).toBeInTheDocument();
  });
});
