import type { PropsWithChildren, ReactElement } from 'react';

import { render } from '@testing-library/react';
import { type InitialEntry, MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '../providers/I18nProvider';
import { AppThemeProvider } from '../theme/AppThemeProvider';

interface RenderWithProvidersOptions {
  initialEntries?: InitialEntry[];
}

/** Renders test UI with application translations, theme, and memory routing. */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntries }: RenderWithProvidersOptions = {},
) {
  return render(ui, {
    /** Supplies application providers to this test render. */
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
    ),
  });
}

/** Composes Web test providers without obsolete credential state. */
function TestProviders({
  children,
  initialEntries = ['/'],
}: PropsWithChildren<RenderWithProvidersOptions>) {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </AppThemeProvider>
    </I18nProvider>
  );
}
