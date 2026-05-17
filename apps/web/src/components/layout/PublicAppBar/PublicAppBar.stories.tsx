import type { Meta, StoryObj } from '@storybook/react-vite';

import { PublicAppBar } from '.';

const meta = {
  args: {
    actionLabel: 'Create account',
    actionTo: '/signup',
  },
  component: PublicAppBar,
  tags: ['autodocs'],
  title: 'Layout/PublicAppBar',
} satisfies Meta<typeof PublicAppBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
