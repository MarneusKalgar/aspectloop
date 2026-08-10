import { Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const EmptyStateRoot = styled(Paper)(({ theme }) => ({
  border: `1px dashed ${theme.palette.divider}`,
  padding: theme.spacing(4),
  textAlign: 'center',
}));

export const EmptyStateContent = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1),
  marginInline: 'auto',
  maxWidth: 480,
}));

export const EmptyStateTitle = styled(Typography)({
  fontSize: '1.125rem',
  fontWeight: 600,
  margin: 0,
});

export const EmptyStateBody = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  margin: 0,
}));
