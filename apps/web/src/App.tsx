import { Container } from '@mui/material';
import { CookiesProvider } from 'react-cookie';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { ApolloAppProvider } from './providers/ApolloAppProvider';
import { I18nProvider } from './providers/I18nProvider';
import { router } from './router';
import { AppThemeProvider } from './theme/AppThemeProvider';

export function App() {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <CookiesProvider>
          <ApolloAppProvider>
            <AuthProvider>
              <Container maxWidth="lg" sx={{ py: 3 }}>
                <RouterProvider router={router} />
              </Container>
            </AuthProvider>
          </ApolloAppProvider>
        </CookiesProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}
