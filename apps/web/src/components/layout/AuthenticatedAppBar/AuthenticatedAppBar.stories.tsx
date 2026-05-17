import type { Meta, StoryObj } from '@storybook/react-vite';

import { AuthenticatedAppBar } from '.';

const meta = {
  args: {
    isMockRuntime: true,
    liveRuntimeLabel: 'Live backend',
    mockRuntimeLabel: 'Mock contract',
    onSignOut: () => {},
    pageLabel: 'Correction inbox',
    signOutLabel: 'Sign out',
    userEmail: 'reviewer@elemika.io',
    userName: 'Avery Stone',
  },
  component: AuthenticatedAppBar,
  tags: ['autodocs'],
  title: 'Layout/AuthenticatedAppBar',
} satisfies Meta<typeof AuthenticatedAppBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
