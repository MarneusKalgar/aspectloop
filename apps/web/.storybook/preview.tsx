import { Box } from '@mui/material';
import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '../src/providers/I18nProvider';
import { AppThemeProvider } from '../src/theme/AppThemeProvider';

const preview: Preview = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <I18nProvider>
          <AppThemeProvider>
            <Box sx={{ minHeight: '100vh' }}>
              <Story />
            </Box>
          </AppThemeProvider>
        </I18nProvider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'fullscreen',
  },
};

export default preview;
