import { IconButton, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';

export const StyledPasswordField = styled(TextField)({
  width: '100%',
});

export const PasswordToggleButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));
