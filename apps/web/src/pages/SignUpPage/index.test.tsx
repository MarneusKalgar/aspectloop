import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';
import { SignUpPage } from './index';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    signUp: vi.fn(),
  }),
}));

describe('SignUpPage', () => {
  it('renders the critical sign-up fields and actions', () => {
    renderWithProviders(<SignUpPage />);

    expect(screen.getByText('Create your review workspace')).toBeInTheDocument();
    // expect(screen.getByRole('textbox', { name: 'Display name' })).toBeInTheDocument();
    //expect(screen.getByRole('textbox', { name: 'Display name' })).toBeInTheDocument();
    expect(screen.getByTestId('display-name-input')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('display-name-input')).getByText('Display name'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'I already have an account' })).toBeInTheDocument();
  });
});
