import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { type PropsWithChildren } from 'react';

const lightTheme = createTheme({
  palette: {
    background: {
      default: '#f5f4ef',
      paper: '#fbfaf6',
    },
    mode: 'light',
    primary: {
      main: '#0c63e7',
    },
    secondary: {
      main: '#0f766e',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
  },
});

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
