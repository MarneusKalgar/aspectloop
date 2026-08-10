import { Alert } from '@mui/material';
import { styled } from '@mui/material/styles';

export const StyledFormAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));
