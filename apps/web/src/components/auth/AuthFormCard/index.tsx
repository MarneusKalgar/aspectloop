import type { ReactNode } from 'react';

import { BrandLogo } from '../../brand/BrandLogo';
import {
  AuthFormCardExtra,
  AuthFormCardFooter,
  AuthFormCardHeader,
  AuthFormCardMobileLogo,
  AuthFormCardRoot,
  AuthFormCardSubtitle,
  AuthFormCardTitle,
} from './AuthFormCard.style';

interface AuthFormCardProps {
  alert?: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  subtitle: string;
  title: string;
}

export function AuthFormCard({
  alert,
  children,
  extra,
  footer,
  subtitle,
  title,
}: AuthFormCardProps) {
  return (
    <AuthFormCardRoot>
      <AuthFormCardMobileLogo>
        <BrandLogo showWordmark={false} stacked variant="large" />
      </AuthFormCardMobileLogo>
      <AuthFormCardHeader>
        <AuthFormCardTitle>{title}</AuthFormCardTitle>
        <AuthFormCardSubtitle>{subtitle}</AuthFormCardSubtitle>
      </AuthFormCardHeader>
      {alert}
      {children}
      {footer ? <AuthFormCardFooter>{footer}</AuthFormCardFooter> : null}
      {extra ? <AuthFormCardExtra>{extra}</AuthFormCardExtra> : null}
    </AuthFormCardRoot>
  );
}
