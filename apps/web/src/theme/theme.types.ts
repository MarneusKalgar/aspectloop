import '@mui/material/styles';

interface AppCustomTheme {
  gradients: AppCustomThemeGradients;
  monoFontFamily: string;
  radii: AppCustomThemeRadii;
  shadows: AppCustomThemeShadows;
  shell: AppCustomThemeShell;
  status: AppCustomThemeStatus;
}

interface AppCustomThemeGradients {
  authHero: string;
}

interface AppCustomThemeOptions {
  gradients?: Partial<AppCustomThemeGradients>;
  monoFontFamily?: string;
  radii?: Partial<AppCustomThemeRadii>;
  shadows?: Partial<AppCustomThemeShadows>;
  shell?: Partial<AppCustomThemeShell>;
  status?: Partial<AppCustomThemeStatus>;
}

interface AppCustomThemeRadii {
  lg: number;
  md: number;
  sm: number;
}

interface AppCustomThemeShadows {
  lg: string;
  md: string;
  sm: string;
  xl: string;
  xs: string;
}

interface AppCustomThemeShell {
  bg: string;
  border: string;
  muted: string;
  surface: string;
  text: string;
}

interface AppCustomThemeStatus {
  errorSoft: string;
  primarySoft: string;
  successSoft: string;
  warningSoft: string;
}

declare module '@mui/material/styles' {
  interface Theme {
    custom: AppCustomTheme;
  }

  interface ThemeOptions {
    custom?: AppCustomThemeOptions;
  }
}

export type { AppCustomTheme, AppCustomThemeOptions };
