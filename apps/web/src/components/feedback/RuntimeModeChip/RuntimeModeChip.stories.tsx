import type { Meta, StoryObj } from '@storybook/react-vite';

import { RuntimeModeChip } from '.';

const meta = {
  args: {
    isMockRuntime: true,
    liveLabel: 'Live backend',
    mockLabel: 'Mock contract',
  },
  component: RuntimeModeChip,
  tags: ['autodocs'],
  title: 'Feedback/RuntimeModeChip',
} satisfies Meta<typeof RuntimeModeChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MockMode: Story = {};

export const LiveMode: Story = {
  args: {
    isMockRuntime: false,
  },
};
