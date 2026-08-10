import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const CorrectionSessionCardRoot = styled(Paper)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
}));

export const CorrectionSessionCardHeader = styled(Stack)(({ theme }) => ({
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  justifyContent: 'space-between',
  [theme.breakpoints.up('sm')]: {
    alignItems: 'center',
    flexDirection: 'row',
  },
}));

export const CorrectionSessionCardMeta = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(0.5),
}));

export const CorrectionSessionCardTitle = styled(Typography)({
  fontSize: '1rem',
  fontWeight: 600,
  margin: 0,
});

export const CorrectionSessionCardSubtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  margin: 0,
}));

export const CorrectionSessionCardDetails = styled(Box)(({ theme }) => ({
  columnGap: theme.spacing(2),
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  marginTop: theme.spacing(2),
  rowGap: theme.spacing(1.5),
}));

export const CorrectionSessionCardDetail = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(0.35),
}));

export const CorrectionSessionCardDetailLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  margin: 0,
  textTransform: 'uppercase',
}));

export const CorrectionSessionCardDetailValue = styled(Typography)({
  fontSize: '0.9375rem',
  fontWeight: 500,
  margin: 0,
});

export const CorrectionSessionCardAction = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  width: '100%',
}));
