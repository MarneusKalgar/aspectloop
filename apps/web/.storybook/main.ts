import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  /**
   * Enables the web app's TypeScript path mapping for Storybook's Vite builder.
   *
   * @param viteConfig The Vite configuration assembled by Storybook.
   * @returns The configuration with TypeScript path resolution enabled.
   */
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      tsconfigPaths: true,
    },
  }),
};

export default config;
