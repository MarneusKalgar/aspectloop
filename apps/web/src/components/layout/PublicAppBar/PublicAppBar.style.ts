import type { SxProps, Theme } from '@mui/material/styles';

import { AppBar, Box, Toolbar } from '@mui/material';
import { styled } from '@mui/material/styles';

export const PublicAppBarRoot = styled(AppBar)(({ theme }) => ({
  background: theme.custom.shell.bg,
  borderBottom: `1px solid ${theme.custom.shell.border}`,
  boxShadow: '0 1px 28px rgba(0,0,0,.35)',
  color: theme.custom.shell.text,
}));

export const PublicAppBarToolbar = styled(Toolbar)(({ theme }) => ({
  gap: theme.spacing(2),
  minHeight: 64,
  paddingInline: theme.spacing(3),
}));

export const PublicAppBarSpacer = styled(Box)({
  flex: 1,
});

export const publicAppBarActionSx: SxProps<Theme> = (theme) => ({
  color: theme.palette.primary.main,
  display: 'none',
  [theme.breakpoints.up('md')]: {
    display: 'inline-flex',
  },
});
