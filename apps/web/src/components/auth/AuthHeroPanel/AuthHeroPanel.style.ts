import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const AuthHeroPanelRoot = styled(Box)(({ theme }) => ({
  '&::before': {
    background:
      `radial-gradient(ellipse 70% 50% at 30% 80%, color-mix(in oklab, ${theme.palette.primary.main} 20%, transparent) 0%, transparent 70%),` +
      'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,.025) 39px, rgba(255,255,255,.025) 40px),' +
      'repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,.025) 39px, rgba(255,255,255,.025) 40px)',
    content: '""',
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  background: theme.custom.gradients.authHero,
  color: '#fff',
  display: 'none',
  overflow: 'hidden',
  padding: theme.spacing(7, 6),
  position: 'relative',
  [theme.breakpoints.up('md')]: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
}));

export const AuthHeroPanelContent = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2.25),
  maxWidth: 320,
  position: 'relative',
  zIndex: 1,
}));

export const AuthHeroEyebrow = styled(Typography)(({ theme }) => ({
  fontFamily: theme.custom.monoFontFamily,
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  margin: 0,
  opacity: 0.5,
  textTransform: 'uppercase',
}));

export const AuthHeroTitle = styled(Typography)({
  fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
  margin: 0,
});

export const AuthHeroDescription = styled(Typography)({
  fontSize: '0.9375rem',
  lineHeight: 1.6,
  margin: 0,
  opacity: 0.65,
});

export const AuthHeroFeatureList = styled('ul')(({ theme }) => ({
  gap: theme.spacing(1.5),
  listStyle: 'none',
  margin: 0,
  padding: 0,
}));

export const AuthHeroFeatureItem = styled('li')(({ theme }) => ({
  '&::before': {
    background: theme.palette.primary.main,
    borderRadius: '50%',
    content: '""',
    flexShrink: 0,
    height: 5,
    marginTop: 8,
    width: 5,
  },
  alignItems: 'flex-start',
  display: 'flex',
  gap: theme.spacing(1.25),
  opacity: 0.75,
}));
