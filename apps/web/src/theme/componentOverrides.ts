import type { Components, Theme } from '@mui/material/styles';

export function getComponentOverrides(theme: Theme): Components<Theme> {
  return {
    MuiAlert: {
      styleOverrides: {
        root: {
          alignItems: 'flex-start',
          borderRadius: theme.custom.radii.sm,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: theme.custom.radii.sm,
          fontWeight: 600,
          letterSpacing: '0.02857em',
          minHeight: 36,
          paddingInline: theme.spacing(2),
          textTransform: 'uppercase',
        },
        sizeLarge: {
          minHeight: 44,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '#root': {
          minHeight: '100vh',
        },
        '*, *::before, *::after': {
          boxSizing: 'border-box',
        },
        body: {
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          minHeight: '100vh',
        },
        html: {
          minHeight: '100%',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: theme.palette.text.secondary,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.32)' : 'rgba(0,0,0,.23)',
        },
        root: {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.text.primary,
          },
          borderRadius: theme.custom.radii.sm,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        outlined: {
          borderColor: theme.palette.divider,
        },
        root: {
          backgroundImage: 'none',
          borderRadius: theme.custom.radii.md,
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        h4: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
        h5: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
      },
    },
  };
}
