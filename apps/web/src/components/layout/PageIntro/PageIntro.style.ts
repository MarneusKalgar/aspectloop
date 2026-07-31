import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const PageIntroRoot = styled(Box)(({ theme }) => ({
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  justifyContent: 'space-between',
  [theme.breakpoints.up('md')]: {
    alignItems: 'center',
    flexDirection: 'row',
  },
}));

export const PageIntroCopy = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(0.75),
}));

export const PageIntroTitle = styled('h1')(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: 'clamp(1.5rem, 2vw, 2rem)',
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1.2,
  margin: 0,
}));

export const PageIntroSubtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  margin: 0,
  maxWidth: 680,
}));

export const PageIntroActions = styled(Box)(({ theme }) => ({
  [theme.breakpoints.up('md')]: {
    width: 'auto',
  },
  width: '100%',
}));
