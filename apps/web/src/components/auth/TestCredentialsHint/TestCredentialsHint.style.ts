import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const TestCredentialsHintRoot = styled(Box)(({ theme }) => ({
  background: theme.palette.background.default,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.custom.radii.sm,
  padding: theme.spacing(1.5),
}));

export const TestCredentialsHintLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  display: 'block',
  fontFamily: theme.custom.monoFontFamily,
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  marginBottom: theme.spacing(0.75),
  textTransform: 'uppercase',
}));

export const TestCredentialsHintValue = styled('code')(({ theme }) => ({
  background: 'rgba(0,0,0,.05)',
  borderRadius: 3,
  fontFamily: theme.custom.monoFontFamily,
  fontSize: '0.8rem',
  padding: '2px 5px',
}));
