import { createTheme } from '@mui/material/styles';

import './theme.types';

import type { AppThemeMode } from './tokens';

import { getComponentOverrides } from './componentOverrides';
import { getThemeTokens } from './tokens';

export function createAppTheme(mode: AppThemeMode) {
  const tokens = getThemeTokens(mode);

  let theme = createTheme({
    cssVariables: {
      nativeColor: true,
    },
    custom: {
      gradients: {
        authHero: tokens.gradients.authHero,
      },
      monoFontFamily: tokens.typography.monoFontFamily,
      radii: {
        lg: tokens.radii.lg,
        md: tokens.radii.md,
        sm: tokens.radii.sm,
      },
      shadows: {
        lg: tokens.shadows.lg,
        md: tokens.shadows.md,
        sm: tokens.shadows.sm,
        xl: tokens.shadows.xl,
        xs: tokens.shadows.xs,
      },
      shell: {
        bg: tokens.palette.shellBg,
        border: tokens.palette.shellBorder,
        muted: tokens.palette.shellMuted,
        surface: tokens.palette.shellSurface,
        text: tokens.palette.shellText,
      },
      status: {
        errorSoft: tokens.palette.errorSoft,
        primarySoft: tokens.palette.primarySoft,
        successSoft: tokens.palette.successSoft,
        warningSoft: tokens.palette.warningSoft,
      },
    },
    palette: {
      background: {
        default: tokens.palette.backgroundDefault,
        paper: tokens.palette.backgroundPaper,
      },
      divider: tokens.palette.divider,
      error: {
        main: tokens.palette.error,
      },
      mode,
      primary: {
        dark: tokens.palette.primaryDark,
        main: tokens.palette.primary,
      },
      secondary: {
        main: tokens.palette.secondary,
      },
      success: {
        main: tokens.palette.success,
      },
      text: {
        disabled: tokens.palette.textDisabled,
        primary: tokens.palette.textPrimary,
        secondary: tokens.palette.textSecondary,
      },
      warning: {
        main: tokens.palette.warning,
      },
    },
    shape: {
      borderRadius: tokens.radii.sm,
    },
    typography: {
      fontFamily: tokens.typography.fontFamily,
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.35,
      },
      h5: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.33,
      },
    },
  });

  theme = createTheme(theme, {
    components: getComponentOverrides(theme),
  });

  return theme;
}
