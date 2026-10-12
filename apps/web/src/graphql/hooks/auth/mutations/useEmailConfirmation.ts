import { useApolloClient } from '@apollo/client/react';
import { AUTH_REQUEST_DEADLINE_MS } from '@app/auth/session-coordination/session-marker';
import { graphql } from '@app/graphql/generated';

const confirmEmailDocument = graphql(`
  mutation ConfirmEmail($input: ConfirmEmailInput!) {
    confirmEmail(input: $input) {
      success
    }
  }
`);

const resendEmailConfirmationDocument = graphql(`
  mutation ResendEmailConfirmation($input: ResendEmailConfirmationInput!) {
    resendEmailConfirmation(input: $input) {
      success
    }
  }
`);

/** Returns imperative uncached executors without retaining token variables in hook state. */
export function useEmailConfirmation() {
  const client = useApolloClient();

  /** Makes exactly one bounded request, without session retries, cache writes, or refetches. */
  async function confirm(token: string): Promise<void> {
    const result = await client.mutate({
      context: { fetchOptions: { signal: AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS) } },
      fetchPolicy: 'no-cache',
      mutation: confirmEmailDocument,
      variables: { input: { token } },
    });

    if (result.data?.confirmEmail.success !== true) {
      throw new Error('Confirmation outcome unavailable');
    }
  }

  /** Requests generic resend acceptance, never account existence or delivery evidence. */
  async function resend(email: string): Promise<void> {
    const result = await client.mutate({
      context: { fetchOptions: { signal: AbortSignal.timeout(AUTH_REQUEST_DEADLINE_MS) } },
      fetchPolicy: 'no-cache',
      mutation: resendEmailConfirmationDocument,
      variables: { input: { email } },
    });

    if (result.data?.resendEmailConfirmation.success !== true) {
      throw new Error('Resend outcome unavailable');
    }
  }

  return { confirm, resend };
}
