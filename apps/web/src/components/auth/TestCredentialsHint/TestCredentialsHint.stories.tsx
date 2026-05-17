import type { Meta, StoryObj } from '@storybook/react-vite';

import { TestCredentialsHint } from '.';

const meta = {
  args: {
    email: 'reviewer@elemika.io',
    label: 'Test credentials',
    password: 'password123',
  },
  component: TestCredentialsHint,
  tags: ['autodocs'],
  title: 'Auth/TestCredentialsHint',
} satisfies Meta<typeof TestCredentialsHint>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
