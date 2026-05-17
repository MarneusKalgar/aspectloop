import type { AlertColor } from '@mui/material';

import { StyledFormAlert } from './FormAlert.style';

interface FormAlertProps {
  message?: null | string;
  severity?: AlertColor;
}

export function FormAlert({ message, severity = 'error' }: FormAlertProps) {
  if (!message) {
    return null;
  }

  return <StyledFormAlert severity={severity}>{message}</StyledFormAlert>;
}
