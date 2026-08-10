import { Typography } from '@mui/material';

import {
  TestCredentialsHintLabel,
  TestCredentialsHintRoot,
  TestCredentialsHintValue,
} from './TestCredentialsHint.style';

interface TestCredentialsHintProps {
  email: string;
  label: string;
  password: string;
}

export function TestCredentialsHint({ email, label, password }: TestCredentialsHintProps) {
  return (
    <TestCredentialsHintRoot>
      <TestCredentialsHintLabel>{label}</TestCredentialsHintLabel>
      <Typography variant="body2">
        <TestCredentialsHintValue>{email}</TestCredentialsHintValue> /{' '}
        <TestCredentialsHintValue>{password}</TestCredentialsHintValue>
      </Typography>
    </TestCredentialsHintRoot>
  );
}
