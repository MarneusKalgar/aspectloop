import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandLogo } from '.';

const meta = {
  component: BrandLogo,
  tags: ['autodocs'],
  title: 'Brand/BrandLogo',
} satisfies Meta<typeof BrandLogo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StackedMarkOnly: Story = {
  args: {
    showWordmark: false,
    stacked: true,
    variant: 'large',
  },
};
