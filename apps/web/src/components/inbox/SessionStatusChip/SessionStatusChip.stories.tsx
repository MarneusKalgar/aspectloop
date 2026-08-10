import type { Meta, StoryObj } from '@storybook/react-vite';

import { SessionStatusChip } from '.';

const meta = {
  args: {
    status: 'OPEN',
  },
  component: SessionStatusChip,
  tags: ['autodocs'],
  title: 'Inbox/SessionStatusChip',
} satisfies Meta<typeof SessionStatusChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Completed: Story = {
  args: {
    status: 'COMPLETED',
  },
};
