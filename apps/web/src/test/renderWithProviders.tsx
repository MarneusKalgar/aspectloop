import type { PropsWithChildren, ReactElement } from 'react';

import { render } from '@testing-library/react';
import { CookiesProvider } from 'react-cookie';
import { type InitialEntry, MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '../providers/I18nProvider';
import { AppThemeProvider } from '../theme/AppThemeProvider';

interface RenderWithProvidersOptions {
  initialEntries?: InitialEntry[];
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries }: RenderWithProvidersOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
    ),
  });
}

function TestProviders({
  children,
  initialEntries = ['/'],
}: PropsWithChildren<RenderWithProvidersOptions>) {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <CookiesProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </CookiesProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}
