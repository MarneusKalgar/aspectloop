import { Box, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const AuthFormCardRoot = styled(Paper)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.custom.shadows.sm,
  maxWidth: 440,
  padding: theme.spacing(3),
  [theme.breakpoints.up('md')]: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    maxWidth: 400,
    padding: 0,
  },
  width: '100%',
}));

export const AuthFormCardHeader = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1),
  marginBottom: theme.spacing(3),
}));

export const AuthFormCardMobileLogo = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: theme.spacing(2.5),
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

export const AuthFormCardTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  lineHeight: 1.35,
  margin: 0,
  [theme.breakpoints.down('md')]: {
    textAlign: 'center',
  },
}));

export const AuthFormCardSubtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  margin: 0,
  [theme.breakpoints.down('md')]: {
    textAlign: 'center',
  },
}));

export const AuthFormCardFooter = styled(Box)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  marginTop: theme.spacing(2.5),
  textAlign: 'center',
}));

export const AuthFormCardExtra = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2.5),
}));
