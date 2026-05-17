import { Avatar, ButtonBase, MenuItem, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const UserAvatarMenuTrigger = styled(ButtonBase)(({ theme }) => ({
  alignItems: 'center',
  borderRadius: 999,
  color: theme.custom.shell.text,
  display: 'inline-flex',
  gap: theme.spacing(1.25),
  padding: theme.spacing(0.5, 0.75),
}));

export const UserAvatarMenuAvatar = styled(Avatar)(({ theme }) => ({
  background: theme.palette.primary.main,
  color: theme.palette.common.white,
  fontSize: '0.875rem',
  fontWeight: 700,
  height: 36,
  width: 36,
}));

export const UserAvatarMenuMeta = styled(Stack)(({ theme }) => ({
  alignItems: 'flex-start',
  display: 'none',
  gap: theme.spacing(0.125),
  [theme.breakpoints.up('md')]: {
    display: 'flex',
  },
}));

export const UserAvatarMenuName = styled(Typography)({
  fontSize: '0.875rem',
  fontWeight: 600,
  lineHeight: 1.2,
  margin: 0,
});

export const UserAvatarMenuEmail = styled(Typography)(({ theme }) => ({
  color: theme.custom.shell.muted,
  fontSize: '0.75rem',
  lineHeight: 1.2,
  margin: 0,
}));

export const UserAvatarMenuAction = styled(MenuItem)(({ theme }) => ({
  minWidth: 180,
  paddingBlock: theme.spacing(1),
}));
