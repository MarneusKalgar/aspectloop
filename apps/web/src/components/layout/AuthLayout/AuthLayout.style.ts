import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export const AuthLayoutRoot = styled(Box)({
  minHeight: '100vh',
});

export const AuthLayoutMain = styled(Box)(({ theme }) => ({
  display: 'grid',
  minHeight: 'calc(100vh - 64px)',
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'minmax(320px, 460px) minmax(0, 1fr)',
  },
}));

export const AuthLayoutFormPane = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(3, 2.5),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4, 3),
  },
}));
