import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { getOperationErrorMessage } from '../graphql/utils/getOperationErrorMessage';
import { createSignInSchema } from '../validators/auth';

interface SignInFormValues {
  email: string;
  password: string;
}

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signInSchema = createSignInSchema(t);

  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<SignInFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values: SignInFormValues) => {
    clearErrors('root');

    try {
      await signIn(values);
      void navigate('/corrections', { replace: true });
    } catch (error) {
      setError('root', {
        message: getOperationErrorMessage(error) ?? t('auth.signIn.error'),
        type: 'server',
      });
    }
  });

  return (
    <Paper sx={{ maxWidth: 560, mx: 'auto', p: 4 }} variant="outlined">
      <Stack
        component="form"
        noValidate
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        spacing={2}
      >
        <Typography component="h1" variant="h4">
          {t('auth.signIn.title')}
        </Typography>
        <Typography color="text.secondary">{t('auth.signIn.subtitle')}</Typography>

        {errors.root?.message ? <Alert severity="error">{errors.root.message}</Alert> : null}

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => {
            const { ref, ...fieldProps } = field;

            return (
              <TextField
                {...fieldProps}
                autoComplete="email"
                error={fieldState.invalid}
                fullWidth
                helperText={fieldState.error?.message}
                inputRef={ref}
                label={t('auth.shared.email')}
                required
                type="email"
              />
            );
          }}
        />

        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => {
            const { ref, ...fieldProps } = field;

            return (
              <TextField
                {...fieldProps}
                autoComplete="current-password"
                error={fieldState.invalid}
                fullWidth
                helperText={fieldState.error?.message}
                inputRef={ref}
                label={t('auth.shared.password')}
                required
                type="password"
              />
            );
          }}
        />

        <Button disabled={isSubmitting} size="large" type="submit" variant="contained">
          {t('auth.signIn.cta.primary')}
        </Button>

        <Button component={RouterLink} to="/signup" variant="text">
          {t('auth.signIn.cta.secondary')}
        </Button>
      </Stack>
    </Paper>
  );
}
