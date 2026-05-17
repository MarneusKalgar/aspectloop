import { Menu } from '@mui/material';
import { useState } from 'react';

import {
  UserAvatarMenuAction,
  UserAvatarMenuAvatar,
  UserAvatarMenuEmail,
  UserAvatarMenuMeta,
  UserAvatarMenuName,
  UserAvatarMenuTrigger,
} from './UserAvatarMenu.style';

interface UserAvatarMenuProps {
  email: string;
  name: string;
  onSignOut: () => void;
  signOutLabel: string;
}

export function UserAvatarMenu({ email, name, onSignOut, signOutLabel }: UserAvatarMenuProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorElement);

  return (
    <>
      <UserAvatarMenuTrigger
        aria-controls={isOpen ? 'user-avatar-menu' : undefined}
        aria-expanded={isOpen ? 'true' : undefined}
        aria-haspopup="menu"
        onClick={(event) => {
          setAnchorElement(event.currentTarget);
        }}
      >
        <UserAvatarMenuAvatar>{getInitials(name)}</UserAvatarMenuAvatar>
        <UserAvatarMenuMeta>
          <UserAvatarMenuName>{name}</UserAvatarMenuName>
          <UserAvatarMenuEmail>{email}</UserAvatarMenuEmail>
        </UserAvatarMenuMeta>
      </UserAvatarMenuTrigger>
      <Menu
        anchorEl={anchorElement}
        id="user-avatar-menu"
        onClose={() => {
          setAnchorElement(null);
        }}
        open={isOpen}
      >
        <UserAvatarMenuAction
          onClick={() => {
            setAnchorElement(null);
            onSignOut();
          }}
        >
          {signOutLabel}
        </UserAvatarMenuAction>
      </Menu>
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
