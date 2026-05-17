export interface AppDesignTokens {
  gradients: {
    authHero: string;
  };
  palette: {
    backgroundDefault: string;
    backgroundPaper: string;
    divider: string;
    error: string;
    errorSoft: string;
    primary: string;
    primaryDark: string;
    primarySoft: string;
    secondary: string;
    shellBg: string;
    shellBorder: string;
    shellMuted: string;
    shellSurface: string;
    shellText: string;
    success: string;
    successSoft: string;
    textDisabled: string;
    textPrimary: string;
    textSecondary: string;
    warning: string;
    warningSoft: string;
  };
  radii: {
    lg: number;
    md: number;
    sm: number;
  };
  shadows: {
    lg: string;
    md: string;
    sm: string;
    xl: string;
    xs: string;
  };
  typography: {
    fontFamily: string;
    monoFontFamily: string;
  };
}

export type AppThemeMode = 'dark' | 'light';

const baseTypography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  monoFontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, monospace',
};

export const lightTokens: AppDesignTokens = {
  gradients: {
    authHero:
      'linear-gradient(148deg, oklch(13% 0.03 258) 0%, oklch(10% 0.04 262) 55%, oklch(14% 0.08 145) 100%)',
  },
  palette: {
    backgroundDefault: 'oklch(95.5% 0.009 252)',
    backgroundPaper: 'oklch(100% 0 0)',
    divider: 'oklch(88% 0.008 250)',
    error: 'oklch(52% 0.24 27)',
    errorSoft: 'oklch(97% 0.04 27)',
    primary: 'oklch(64% 0.24 145)',
    primaryDark: 'oklch(50% 0.24 145)',
    primarySoft: 'oklch(97% 0.07 145)',
    secondary: 'oklch(58% 0.22 264)',
    shellBg: 'oklch(13% 0.03 258)',
    shellBorder: 'oklch(24% 0.025 258)',
    shellMuted: 'oklch(58% 0.02 258)',
    shellSurface: 'oklch(18% 0.03 258)',
    shellText: 'oklch(95% 0.008 258)',
    success: 'oklch(60% 0.22 145)',
    successSoft: 'oklch(97% 0.05 145)',
    textDisabled: 'oklch(68% 0.01 255)',
    textPrimary: 'oklch(11% 0.025 255)',
    textSecondary: 'oklch(44% 0.018 255)',
    warning: 'oklch(72% 0.18 65)',
    warningSoft: 'oklch(97% 0.04 65)',
  },
  radii: {
    lg: 16,
    md: 10,
    sm: 6,
  },
  shadows: {
    lg: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
    md: '0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)',
    sm: '0 1px 2px 0 rgba(0,0,0,.06)',
    xl: '0 20px 25px -5px rgba(0,0,0,.14), 0 8px 10px -6px rgba(0,0,0,.1)',
    xs: '0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)',
  },
  typography: baseTypography,
};

export const darkTokens: AppDesignTokens = {
  gradients: {
    authHero:
      'linear-gradient(148deg, oklch(7% 0.018 258) 0%, oklch(9% 0.04 262) 55%, oklch(13% 0.08 145) 100%)',
  },
  palette: {
    backgroundDefault: 'oklch(10% 0.025 258)',
    backgroundPaper: 'oklch(21% 0.03 258)',
    divider: 'oklch(36% 0.025 258)',
    error: 'oklch(58% 0.24 27)',
    errorSoft: 'oklch(18% 0.06 27)',
    primary: 'oklch(64% 0.24 145)',
    primaryDark: 'oklch(50% 0.24 145)',
    primarySoft: 'oklch(22% 0.08 145)',
    secondary: 'oklch(62% 0.22 264)',
    shellBg: 'oklch(7% 0.018 258)',
    shellBorder: 'oklch(30% 0.022 258)',
    shellMuted: 'oklch(56% 0.018 258)',
    shellSurface: 'oklch(11% 0.024 258)',
    shellText: 'oklch(95% 0.008 258)',
    success: 'oklch(64% 0.22 145)',
    successSoft: 'oklch(18% 0.07 145)',
    textDisabled: 'oklch(38% 0.01 255)',
    textPrimary: 'oklch(94% 0.008 258)',
    textSecondary: 'oklch(72% 0.015 258)',
    warning: 'oklch(74% 0.18 65)',
    warningSoft: 'oklch(20% 0.06 65)',
  },
  radii: {
    lg: 16,
    md: 10,
    sm: 6,
  },
  shadows: {
    lg: '0 10px 15px -3px rgba(0,0,0,.55), 0 4px 6px -4px rgba(0,0,0,.5)',
    md: '0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.5)',
    sm: '0 1px 2px 0 rgba(0,0,0,.4)',
    xl: '0 20px 25px -5px rgba(0,0,0,.65), 0 8px 10px -6px rgba(0,0,0,.5)',
    xs: '0 1px 3px 0 rgba(0,0,0,.5), 0 1px 2px -1px rgba(0,0,0,.5)',
  },
  typography: baseTypography,
};

export function getThemeTokens(mode: AppThemeMode) {
  return mode === 'dark' ? darkTokens : lightTokens;
}
