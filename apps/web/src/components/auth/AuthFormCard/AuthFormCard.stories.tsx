import { Button, Stack, TextField } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormAlert } from '@app/components/feedback/FormAlert';
import { TestCredentialsHint } from '../TestCredentialsHint';
import { AuthFormCard } from '.';

const meta = {
  component: AuthFormCard,
  tags: ['autodocs'],
  title: 'Auth/AuthFormCard',
} satisfies Meta<typeof AuthFormCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignInVariant: Story = {
  args: {
    children: null,
    subtitle: 'Sign in to open your correction inbox.',
    title: 'Review extracted data with evidence at hand',
  },
  render: () => (
    <AuthFormCard
      alert={
        <FormAlert message="Could not sign you in. Check your email and password and try again." />
      }
      extra={
        <TestCredentialsHint
          email="reviewer@elemika.io"
          label="Test credentials"
          password="password123"
        />
      }
      footer={<Button variant="text">Create account</Button>}
      subtitle="Sign in to open your correction inbox."
      title="Review extracted data with evidence at hand"
    >
      <Stack spacing={2}>
        <TextField label="Email" value="reviewer@elemika.io" />
        <TextField label="Password" type="password" value="password123" />
        <Button variant="contained">Sign in</Button>
      </Stack>
    </AuthFormCard>
  ),
};
