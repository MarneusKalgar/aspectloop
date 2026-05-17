import { Paper, TableCell, TableHead } from '@mui/material';
import { styled } from '@mui/material/styles';

export const CorrectionSessionsTableRoot = styled(Paper)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

export const CorrectionSessionsTableHead = styled(TableHead)(({ theme }) => ({
  background: theme.palette.background.default,
}));

export const CorrectionSessionsHeaderCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}));
