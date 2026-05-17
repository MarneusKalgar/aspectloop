import { CssBaseline, ThemeProvider } from '@mui/material';
import { type PropsWithChildren } from 'react';

import { createAppTheme } from './createAppTheme';

const lightTheme = createAppTheme('light');

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
