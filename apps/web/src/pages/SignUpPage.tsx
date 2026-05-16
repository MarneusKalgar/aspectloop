import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { getOperationErrorMessage } from '../graphql/utils/getOperationErrorMessage';
import { createSignUpSchema } from '../validators/auth';

interface SignUpFormValues {
  displayName: string;
  email: string;
  password: string;
}

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signUpSchema = createSignUpSchema(t);
  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<SignUpFormValues>({
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values: SignUpFormValues) => {
    clearErrors('root');

    try {
      await signUp(values);

      void navigate('/signin', {
        replace: true,
        state: { successMessage: t('auth.signUp.success') },
      });
    } catch (error) {
      setError('root', {
        message: getOperationErrorMessage(error) ?? t('auth.signUp.error'),
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
          {t('auth.signUp.title')}
        </Typography>

        <Typography color="text.secondary">{t('auth.signUp.subtitle')}</Typography>

        {errors.root?.message ? <Alert severity="error">{errors.root.message}</Alert> : null}

        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => {
            const { ref, ...fieldProps } = field;

            return (
              <TextField
                {...fieldProps}
                autoComplete="name"
                error={fieldState.invalid}
                fullWidth
                helperText={fieldState.error?.message}
                inputRef={ref}
                label={t('auth.signUp.displayName')}
                required
              />
            );
          }}
        />

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
                autoComplete="new-password"
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
          {t('auth.signUp.cta.primary')}
        </Button>
        <Button component={RouterLink} to="/signin" variant="text">
          {t('auth.signUp.cta.secondary')}
        </Button>
      </Stack>
    </Paper>
  );
}
