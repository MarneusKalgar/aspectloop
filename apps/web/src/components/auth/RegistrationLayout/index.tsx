import type { PropsWithChildren } from 'react';

import { AuthLayout } from '@app/components/layout/AuthLayout';
import { useTranslation } from 'react-i18next';

/** Reuses the account layout without implying registration has created a session. */
export function RegistrationLayout({ children }: PropsWithChildren) {
  const { t } = useTranslation();

  return (
    <AuthLayout
      heroDescription={t('auth.confirmation.hero.description')}
      heroEyebrow={t('auth.confirmation.hero.eyebrow')}
      heroFeatures={[
        t('auth.confirmation.hero.feature1'),
        t('auth.confirmation.hero.feature2'),
        t('auth.confirmation.hero.feature3'),
      ]}
      heroTitle={t('auth.confirmation.hero.title')}
      topActionLabel={t('auth.signIn.cta.primary')}
      topActionTo="/signin"
    >
      {children}
    </AuthLayout>
  );
}
