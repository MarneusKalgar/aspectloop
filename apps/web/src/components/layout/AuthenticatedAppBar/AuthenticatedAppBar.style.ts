import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const AuthenticatedAppBarRoot = styled(AppBar)(({ theme }) => ({
  background: theme.custom.shell.bg,
  borderBottom: `1px solid ${theme.custom.shell.border}`,
  boxShadow: '0 1px 28px rgba(0,0,0,.35)',
  color: theme.custom.shell.text,
}));

export const AuthenticatedAppBarToolbar = styled(Toolbar)(({ theme }) => ({
  gap: theme.spacing(2),
  marginInline: 'auto',
  maxWidth: 1240,
  minHeight: 72,
  paddingInline: theme.spacing(2),
  [theme.breakpoints.up('md')]: {
    paddingInline: theme.spacing(3),
  },
  width: '100%',
}));

export const AuthenticatedAppBarTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.shell.muted,
  display: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  margin: 0,
  [theme.breakpoints.up('md')]: {
    display: 'block',
  },
}));

export const AuthenticatedAppBarSpacer = styled(Box)({
  flex: 1,
});

export const AuthenticatedAppBarCluster = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  display: 'flex',
  gap: theme.spacing(1.5),
}));
