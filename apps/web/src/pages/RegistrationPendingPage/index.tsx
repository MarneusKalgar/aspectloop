import { AuthFormCard } from '@app/components/auth/AuthFormCard';
import { RegistrationLayout } from '@app/components/auth/RegistrationLayout';
import { createResendConfirmationSchema } from '@app/validators/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import { RESEND_FEEDBACK } from './registration.constants';
import { useResendConfirmation } from './useResendConfirmation';

/** Keeps signup and resend neutral; no mailbox is passed through router history. */
export function RegistrationPendingPage() {
  const { t } = useTranslation();
  const { busy, feedback, seconds, submit } = useResendConfirmation();
  const { control, handleSubmit } = useForm<{ email: string }>({
    defaultValues: { email: '' },
    resolver: zodResolver(createResendConfirmationSchema(t)),
  });
  const onSubmit = handleSubmit(
    /** Sends only validated registration mailboxes without probing their existence. */
    async ({ email }) => {
      await submit(email);
    },
  );

  return (
    <RegistrationLayout>
      <AuthFormCard
        footer={
          <Button component={RouterLink} to="/signin">
            {t('auth.signIn.cta.primary')}
          </Button>
        }
        subtitle={t('auth.pending.subtitle')}
        title={t('auth.pending.title')}
      >
        <Stack
          aria-busy={busy}
          component="form"
          noValidate
          onSubmit={
            /** Keeps React's form handler synchronous while the bounded request owns completion. */
            (event) => {
              void onSubmit(event);
            }
          }
          spacing={2}
        >
          <Alert role="status" severity="info">
            {t('auth.signUp.success')}
          </Alert>
          <Typography>{t('auth.pending.guidance')}</Typography>
          {feedback && (
            <Alert
              role="status"
              severity={
                feedback === RESEND_FEEDBACK.ERROR || feedback === RESEND_FEEDBACK.RATE_LIMITED
                  ? 'warning'
                  : 'info'
              }
            >
              {t(`auth.pending.${feedback}`)}
            </Alert>
          )}
          <Controller
            control={control}
            name="email"
            render={
              /** Reuses the accessible account form field and its server-independent validation. */
              ({ field: { ref, ...field }, fieldState }) => (
                <TextField
                  {...field}
                  autoComplete="email"
                  error={fieldState.invalid}
                  helperText={fieldState.error?.message}
                  inputRef={ref}
                  label={t('auth.shared.email')}
                  required
                  type="email"
                />
              )
            }
          />
          <Button disabled={busy || seconds > 0} type="submit" variant="contained">
            {t(busy ? 'auth.pending.sending' : 'auth.confirmation.resend')}
          </Button>
          {seconds > 0 && (
            <Typography role="status">{t('auth.pending.wait', { seconds })}</Typography>
          )}
        </Stack>
      </AuthFormCard>
    </RegistrationLayout>
  );
}
