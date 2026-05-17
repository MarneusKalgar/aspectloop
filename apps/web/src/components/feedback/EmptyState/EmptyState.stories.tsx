import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyState } from '.';

const meta = {
  args: {
    body: 'New sessions will appear here when documents are ready for review.',
    title: 'No correction sessions yet',
  },
  component: EmptyState,
  tags: ['autodocs'],
  title: 'Feedback/EmptyState',
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
