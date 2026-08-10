import { BrandLogo } from '@app/components/brand/BrandLogo';
import { RuntimeModeChip } from '@app/components/feedback/RuntimeModeChip';
import { UserAvatarMenu } from '@app/components/navigation/UserAvatarMenu';
import { ButtonBase } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import {
  AuthenticatedAppBarCluster,
  AuthenticatedAppBarRoot,
  AuthenticatedAppBarSpacer,
  AuthenticatedAppBarTitle,
  AuthenticatedAppBarToolbar,
} from './AuthenticatedAppBar.style';

interface AuthenticatedAppBarProps {
  isMockRuntime: boolean;
  liveRuntimeLabel: string;
  mockRuntimeLabel: string;
  onSignOut: () => void;
  pageLabel: string;
  signOutLabel: string;
  userEmail: string;
  userName: string;
}

export function AuthenticatedAppBar({
  isMockRuntime,
  liveRuntimeLabel,
  mockRuntimeLabel,
  onSignOut,
  pageLabel,
  signOutLabel,
  userEmail,
  userName,
}: AuthenticatedAppBarProps) {
  return (
    <AuthenticatedAppBarRoot elevation={0} position="sticky">
      <AuthenticatedAppBarToolbar>
        <AuthenticatedAppBarCluster>
          <ButtonBase component={RouterLink} sx={{ borderRadius: 1 }} to="/corrections">
            <BrandLogo />
          </ButtonBase>
          <AuthenticatedAppBarTitle>{pageLabel}</AuthenticatedAppBarTitle>
        </AuthenticatedAppBarCluster>
        <AuthenticatedAppBarSpacer />
        <AuthenticatedAppBarCluster>
          <RuntimeModeChip
            isMockRuntime={isMockRuntime}
            liveLabel={liveRuntimeLabel}
            mockLabel={mockRuntimeLabel}
          />
          <UserAvatarMenu
            email={userEmail}
            name={userName}
            onSignOut={onSignOut}
            signOutLabel={signOutLabel}
          />
        </AuthenticatedAppBarCluster>
      </AuthenticatedAppBarToolbar>
    </AuthenticatedAppBarRoot>
  );
}
