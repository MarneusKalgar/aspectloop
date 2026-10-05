import { Box } from '@mui/material';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { SessionCoordinatorProvider } from './auth/session-coordination/SessionCoordinatorProvider';
import { ApolloAppProvider } from './providers/ApolloAppProvider';
import { I18nProvider } from './providers/I18nProvider';
import { router } from './router';
import { AppThemeProvider } from './theme/AppThemeProvider';

/** Composes tab coordination outside both Apollo transport and routed identity consumers. */
export function App() {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <SessionCoordinatorProvider>
          <ApolloAppProvider>
            <AuthProvider>
              <Box sx={{ minHeight: '100vh' }}>
                <RouterProvider router={router} />
              </Box>
            </AuthProvider>
          </ApolloAppProvider>
        </SessionCoordinatorProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}
