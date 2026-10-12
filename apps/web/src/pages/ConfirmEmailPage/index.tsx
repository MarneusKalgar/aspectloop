import { confirmationAttempt } from '@app/auth/email-confirmation/confirmation-attempt';
import { AuthFormCard } from '@app/components/auth/AuthFormCard';
import { RegistrationLayout } from '@app/components/auth/RegistrationLayout';
import { useEmailConfirmation } from '@app/graphql/hooks/auth/mutations/useEmailConfirmation';
import { Alert, Button, Stack } from '@mui/material';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import { confirmationPresentation } from './confirmation-presentation';

/** Presents the sanitized link; mounting or session bootstrap never consumes it. */
export function ConfirmEmailPage() {
  const { t } = useTranslation();
  const { confirm } = useEmailConfirmation();
  const status = useSyncExternalStore(
    confirmationAttempt.subscribe,
    confirmationAttempt.getSnapshot,
  );
  const presentation = confirmationPresentation(status);

  /** Hands the secret directly to one uncached request after explicit consent. */
  function onConfirm(): void {
    void confirmationAttempt.confirm(confirm);
  }

  return (
    <RegistrationLayout>
      <AuthFormCard
        footer={
          <Button component={RouterLink} to="/registration-pending">
            {t('auth.confirmation.resend')}
          </Button>
        }
        subtitle={t('auth.confirmation.subtitle')}
        title={t('auth.confirmation.title')}
      >
        <Stack aria-busy={presentation.busy} spacing={2}>
          <Alert role="status" severity={presentation.severity}>
            {t(presentation.messageKey)}
          </Alert>
          {presentation.actionKey !== null && (
            <Button disabled={presentation.busy} onClick={onConfirm} variant="contained">
              {t(presentation.actionKey)}
            </Button>
          )}
          <Button component={RouterLink} to="/signin" variant="text">
            {t('auth.signIn.cta.primary')}
          </Button>
        </Stack>
      </AuthFormCard>
    </RegistrationLayout>
  );
}
