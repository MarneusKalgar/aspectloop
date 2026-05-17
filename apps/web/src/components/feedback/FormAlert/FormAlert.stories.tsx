import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormAlert } from '.';

const meta = {
  component: FormAlert,
  tags: ['autodocs'],
  title: 'Feedback/FormAlert',
} satisfies Meta<typeof FormAlert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: {
    message: 'Could not complete this action.',
    severity: 'error',
  },
};

export const Success: Story = {
  args: {
    message: 'Account created. Sign in to continue.',
    severity: 'success',
  },
};
