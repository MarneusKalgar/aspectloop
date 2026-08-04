import { TestCredentialsHint } from '@app/components/auth/TestCredentialsHint';
import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { useTranslation } from 'react-i18next';

/**
 * Renders mocked sign-in credentials for local development and browser tests.
 *
 * @returns The mock credential hint shown below the sign-in form.
 */
export default function DevelopmentTestCredentialsHintContent() {
  const { t } = useTranslation();

  return (
    <TestCredentialsHint
      email={defaultMockReviewerCredentials.email}
      label={t('auth.signIn.testCredentials.label')}
      password={defaultMockReviewerCredentials.password}
    />
  );
}
