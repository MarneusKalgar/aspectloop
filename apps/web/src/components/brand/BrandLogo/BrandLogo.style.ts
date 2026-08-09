import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const BrandLogoRoot = styled(Stack)<{ ownerState: { stacked: boolean } }>(
  ({ ownerState, theme }) => ({
    alignItems: 'center',
    color: theme.custom.shell.text,
    display: 'inline-flex',
    flexDirection: ownerState.stacked ? 'column' : 'row',
    gap: ownerState.stacked ? theme.spacing(1.5) : theme.spacing(1.25),
    justifyContent: 'center',
    textDecoration: 'none',
  }),
);

export const BrandMark = styled(Box)<{ ownerState: { large: boolean } }>(
  ({ ownerState, theme }) => ({
    alignItems: 'center',
    background: theme.palette.primary.main,
    borderRadius: ownerState.large ? theme.custom.radii.lg - 2 : 8,
    boxShadow: ownerState.large
      ? `0 0 0 2px color-mix(in oklab, ${theme.palette.primary.main} 40%, transparent), 0 10px 24px color-mix(in oklab, ${theme.palette.primary.main} 42%, transparent)`
      : `0 0 0 2px color-mix(in oklab, ${theme.palette.primary.main} 40%, transparent), 0 4px 14px color-mix(in oklab, ${theme.palette.primary.main} 55%, transparent)`,
    color: '#fff',
    display: 'inline-flex',
    fontFamily: theme.typography.fontFamily,
    fontSize: ownerState.large ? '1.125rem' : '0.75rem',
    fontWeight: 700,
    height: ownerState.large ? 52 : 32,
    justifyContent: 'center',
    letterSpacing: 0,
    lineHeight: 1,
    width: ownerState.large ? 52 : 32,
  }),
);

export const BrandName = styled(Typography)(({ theme }) => ({
  color: theme.custom.shell.text,
  fontSize: '1.1rem',
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: 1,
  whiteSpace: 'nowrap',
}));
