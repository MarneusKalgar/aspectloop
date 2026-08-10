import type { Meta, StoryObj } from '@storybook/react-vite';

import { PasswordField } from '.';

const meta = {
  args: {
    defaultValue: 'example-password',
    helperText: 'At least 8 characters',
    label: 'Password',
  },
  component: PasswordField,
  tags: ['autodocs'],
  title: 'Auth/PasswordField',
} satisfies Meta<typeof PasswordField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
