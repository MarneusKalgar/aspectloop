import { Box, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

export const InboxFilterChipsRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

export const InboxFilterChip = styled(Chip)({
  borderRadius: 999,
});
