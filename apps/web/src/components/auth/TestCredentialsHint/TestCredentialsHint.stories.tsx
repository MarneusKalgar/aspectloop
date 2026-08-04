import type { Meta, StoryObj } from '@storybook/react-vite';

import { TestCredentialsHint } from '.';

const meta = {
  args: {
    email: 'reviewer@example.test',
    label: 'Test credentials',
    password: 'example-password',
  },
  component: TestCredentialsHint,
  tags: ['autodocs'],
  title: 'Auth/TestCredentialsHint',
} satisfies Meta<typeof TestCredentialsHint>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
