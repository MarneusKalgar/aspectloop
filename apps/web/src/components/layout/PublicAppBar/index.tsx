import { Button, ButtonBase } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { BrandLogo } from '../../brand/BrandLogo';
import {
  publicAppBarActionSx,
  PublicAppBarRoot,
  PublicAppBarSpacer,
  PublicAppBarToolbar,
} from './PublicAppBar.style';

interface PublicAppBarProps {
  actionLabel?: string;
  actionTo?: string;
}

export function PublicAppBar({ actionLabel, actionTo }: PublicAppBarProps) {
  return (
    <PublicAppBarRoot elevation={0} position="sticky">
      <PublicAppBarToolbar>
        <ButtonBase component={RouterLink} sx={{ borderRadius: 1 }} to="/">
          <BrandLogo />
        </ButtonBase>
        <PublicAppBarSpacer />
        {actionLabel && actionTo ? (
          <Button component={RouterLink} sx={publicAppBarActionSx} to={actionTo} variant="text">
            {actionLabel}
          </Button>
        ) : null}
      </PublicAppBarToolbar>
    </PublicAppBarRoot>
  );
}
