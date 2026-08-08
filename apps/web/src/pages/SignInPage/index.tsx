import { useAuth } from '@app/auth/useAuth';
import { AuthFormCard } from '@app/components/auth/AuthFormCard';
import { DevelopmentTestCredentialsHint } from '@app/components/auth/DevelopmentTestCredentialsHint';
import { PasswordField } from '@app/components/auth/PasswordField';
import { FormAlert } from '@app/components/feedback/FormAlert';
import { AuthLayout } from '@app/components/layout/AuthLayout';
import { getOperationErrorMessage } from '@app/graphql/utils/getOperationErrorMessage';
import { createSignInSchema } from '@app/validators/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

interface SignInFormValues {
  email: string;
  password: string;
}

interface SignInLocationState {
  successMessage?: string;
}

export function SignInPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signInSchema = createSignInSchema(t);
  const successMessage = (location.state as null | SignInLocationState)?.successMessage ?? null;

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
    <AuthLayout
      heroDescription={t('auth.signIn.hero.description')}
      heroEyebrow={t('auth.signIn.hero.eyebrow')}
      heroFeatures={[
        t('auth.signIn.hero.feature1'),
        t('auth.signIn.hero.feature2'),
        t('auth.signIn.hero.feature3'),
      ]}
      heroTitle={t('auth.signIn.hero.title')}
      topActionLabel={t('auth.signIn.cta.secondary')}
      topActionTo="/signup"
    >
      <AuthFormCard
        alert={
          <>
            <FormAlert message={successMessage} severity="success" />
            <FormAlert message={errors.root?.message ?? null} />
          </>
        }
        extra={<DevelopmentTestCredentialsHint />}
        footer={
          <Button component={RouterLink} data-testid="signup-link" to="/signup" variant="text">
            {t('auth.signIn.cta.secondary')}
          </Button>
        }
        subtitle={t('auth.signIn.subtitle')}
        title={t('auth.signIn.title')}
      >
        <Stack
          component="form"
          noValidate
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          spacing={2}
        >
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
                <PasswordField
                  {...fieldProps}
                  autoComplete="current-password"
                  error={fieldState.invalid}
                  fullWidth
                  helperText={fieldState.error?.message}
                  inputRef={ref}
                  label={t('auth.shared.password')}
                  required
                />
              );
            }}
          />

          <Button disabled={isSubmitting} size="large" type="submit" variant="contained">
            {t('auth.signIn.cta.primary')}
          </Button>
        </Stack>
      </AuthFormCard>
    </AuthLayout>
  );
}
