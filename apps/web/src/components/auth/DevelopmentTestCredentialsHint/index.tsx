import { env } from '@app/config/env';
import { lazy, Suspense } from 'react';

const DevelopmentTestCredentialsHintContent = import.meta.env.DEV
  ? lazy(
      /**
       * Loads the mock credential content only in development bundles.
       *
       * @returns A module with the credential content as its default export.
       */
      () => import('./DevelopmentTestCredentialsHintContent'),
    )
  : null;

/**
 * Renders mock sign-in credentials only when the local browser mock runtime is enabled.
 *
 * @returns The development credential hint, or no UI outside that runtime.
 */
export function DevelopmentTestCredentialsHint() {
  if (!import.meta.env.DEV || !env.mockGraphqlRuntime || !DevelopmentTestCredentialsHintContent) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DevelopmentTestCredentialsHintContent />
    </Suspense>
  );
}
