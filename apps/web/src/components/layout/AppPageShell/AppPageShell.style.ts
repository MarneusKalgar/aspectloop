import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export const AppPageShellRoot = styled(Box)(({ theme }) => ({
  background: theme.palette.background.default,
  minHeight: '100vh',
  paddingBottom: theme.spacing(5),
}));

export const AppPageShellInner = styled(Box)(({ theme }) => ({
  marginInline: 'auto',
  maxWidth: 1240,
  paddingInline: theme.spacing(2),
  paddingTop: theme.spacing(3),
  [theme.breakpoints.up('md')]: {
    paddingInline: theme.spacing(3),
    paddingTop: theme.spacing(4),
  },
  width: '100%',
}));
