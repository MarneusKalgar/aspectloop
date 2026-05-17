import type { Meta, StoryObj } from '@storybook/react-vite';

import { InboxStatCard } from '.';

const meta = {
  args: {
    label: 'Assigned to me',
    tone: 'shell',
    value: '24',
  },
  component: InboxStatCard,
  tags: ['autodocs'],
  title: 'Inbox/InboxStatCard',
} satisfies Meta<typeof InboxStatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    label: 'In progress',
    tone: 'primary',
    value: '3',
  },
};

export const Paper: Story = {
  args: {
    label: 'Completed today',
    tone: 'default',
    value: '1',
  },
};
