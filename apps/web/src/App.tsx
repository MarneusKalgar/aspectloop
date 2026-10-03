import { Box } from '@mui/material';
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
        <ApolloAppProvider>
          <AuthProvider>
            <Box sx={{ minHeight: '100vh' }}>
              <RouterProvider router={router} />
            </Box>
          </AuthProvider>
        </ApolloAppProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}
