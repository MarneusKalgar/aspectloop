import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageIntro } from '.';

const meta = {
  component: PageIntro,
  tags: ['autodocs'],
  title: 'Layout/PageIntro',
} satisfies Meta<typeof PageIntro>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    subtitle: 'Open an active review session and continue where you left off.',
    title: 'Correction inbox',
  },
  render: () => (
    <PageIntro
      actions={<Button variant="contained">Primary action</Button>}
      subtitle="Open an active review session and continue where you left off."
      title="Correction inbox"
    />
  ),
};
