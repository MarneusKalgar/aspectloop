import type { Meta, StoryObj } from '@storybook/react-vite';

import { UserAvatarMenu } from '.';

const meta = {
  args: {
    email: 'reviewer@example.test',
    name: 'Avery Stone',
    onSignOut: () => {},
    signOutLabel: 'Sign out',
  },
  component: UserAvatarMenu,
  tags: ['autodocs'],
  title: 'Navigation/UserAvatarMenu',
} satisfies Meta<typeof UserAvatarMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
