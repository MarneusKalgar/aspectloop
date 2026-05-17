import type { Theme } from '@mui/material/styles';

import { Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export type InboxStatCardTone = 'default' | 'primary' | 'shell';

interface InboxStatCardOwnerState {
  tone: InboxStatCardTone;
}

function getToneStyles(theme: Theme, tone: InboxStatCardTone) {
  switch (tone) {
    case 'primary':
      return {
        background: theme.palette.primary.main,
        border: '1px solid transparent',
        boxShadow: `0 16px 32px color-mix(in srgb, ${theme.palette.primary.main} 24%, transparent)`,
        labelColor: 'rgba(255,255,255,.92)',
        textColor: theme.palette.common.white,
      };
    case 'shell':
      return {
        background: theme.custom.shell.bg,
        border: '1px solid transparent',
        boxShadow: theme.custom.shadows.lg,
        labelColor: 'rgba(255,255,255,.92)',
        textColor: theme.custom.shell.text,
      };
    default:
      return {
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.custom.shadows.xs,
        labelColor: theme.palette.text.secondary,
        textColor: theme.palette.primary.main,
      };
  }
}

export const InboxStatCardRoot = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'ownerState',
})<{ ownerState: InboxStatCardOwnerState }>(({ ownerState, theme }) => {
  const toneStyles = getToneStyles(theme, ownerState.tone);

  return {
    background: toneStyles.background,
    border: toneStyles.border,
    borderRadius: theme.custom.radii.lg,
    boxShadow: toneStyles.boxShadow,
    minHeight: 152,
    padding: theme.spacing(2.5),
  };
});

export const InboxStatCardLabel = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'ownerState',
})<{ ownerState: InboxStatCardOwnerState }>(({ ownerState, theme }) => ({
  color: getToneStyles(theme, ownerState.tone).labelColor,
  fontSize: '0.9rem',
  fontWeight: 500,
  margin: 0,
}));

export const InboxStatCardValue = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'ownerState',
})<{ ownerState: InboxStatCardOwnerState }>(({ ownerState, theme }) => ({
  color: getToneStyles(theme, ownerState.tone).textColor,
  fontSize: '3rem',
  fontWeight: 600,
  letterSpacing: '-0.03em',
  lineHeight: 1,
  margin: 0,
}));

export const InboxStatCardHint = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'ownerState',
})<{ ownerState: InboxStatCardOwnerState }>(({ ownerState, theme }) => ({
  color: getToneStyles(theme, ownerState.tone).labelColor,
  fontSize: '0.875rem',
  margin: 0,
  opacity: 0.82,
}));

export const InboxStatCardContent = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1.5),
  height: '100%',
  justifyContent: 'space-between',
}));
