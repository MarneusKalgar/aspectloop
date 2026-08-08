import type { ReactNode } from 'react';

import { AuthHeroPanel } from '@app/components/auth/AuthHeroPanel';

import { PublicAppBar } from '../PublicAppBar';
import { AuthLayoutFormPane, AuthLayoutMain, AuthLayoutRoot } from './AuthLayout.style';

interface AuthLayoutProps {
  children: ReactNode;
  heroDescription: string;
  heroEyebrow: string;
  heroFeatures: string[];
  heroTitle: string;
  topActionLabel: string;
  topActionTo: string;
}

export function AuthLayout({
  children,
  heroDescription,
  heroEyebrow,
  heroFeatures,
  heroTitle,
  topActionLabel,
  topActionTo,
}: AuthLayoutProps) {
  return (
    <AuthLayoutRoot>
      <PublicAppBar actionLabel={topActionLabel} actionTo={topActionTo} />
      <AuthLayoutMain>
        <AuthHeroPanel
          description={heroDescription}
          eyebrow={heroEyebrow}
          features={heroFeatures}
          title={heroTitle}
        />
        <AuthLayoutFormPane>{children}</AuthLayoutFormPane>
      </AuthLayoutMain>
    </AuthLayoutRoot>
  );
}
