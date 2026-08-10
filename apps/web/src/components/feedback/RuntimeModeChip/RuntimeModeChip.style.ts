import { Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

export const RuntimeModeChipRoot = styled(Chip)(({ theme }) => ({
  '.MuiChip-label': {
    paddingInline: theme.spacing(1.25),
  },
  borderRadius: 999,
  fontWeight: 600,
}));
