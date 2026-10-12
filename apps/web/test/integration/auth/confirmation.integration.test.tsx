import type {
  ConfirmEmailMutation,
  ConfirmEmailMutationVariables,
} from '@app/graphql/generated/graphql';

import { App } from '@app/App';
import { initializeConfirmationAttempt } from '@app/auth/email-confirmation/confirmation-attempt';
import { captureConfirmationLink } from '@app/auth/email-confirmation/confirmation-link';
import {
  createMockUser,
  findMockUserByEmail,
  getMockSessionUser,
  setMockSessionUser,
} from '@app/mocks/data';
import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import {
  consumeMockConfirmation,
  getMockConfirmationToken,
  requestMockConfirmation,
} from '@app/mocks/registration';
import { router } from '@app/router';
import { deferred } from '@app/test/session-environment';
import { server } from '@app/test/setup';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

/** Opens an owned fixture through the same synchronous capture used by the entry point. */
async function openConfirmation(token: string) {
  window.history.replaceState(null, '', `/confirm-email#token=${token}`);
  initializeConfirmationAttempt(captureConfirmationLink());

  await act(
    /** Navigates to an explicitly public route before rendering its providers. */ async () => {
      await router.navigate('/confirm-email');
    },
  );

  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/** Allocates a distinct test-only unverified account and its private token. */
function pendingAccount() {
  const email = `${crypto.randomUUID()}@example.test`;
  createMockUser({ displayName: 'Pending', email, password: 'fixture-password' });
  requestMockConfirmation(email);

  return { email, token: getMockConfirmationToken(email)! };
}

describe('explicit email confirmation integration', /** Groups real-provider interaction with the typed mock boundary. */ () => {
  /** Provider-owned recovery survives pending login unmounting the original form. */
  it('retains the unverified resend link after rejected sign-in remounts the form', async () => {
    const fixture = pendingAccount();

    await act(
      /** Opens ordinary anonymous login through the real routed session boundary. */ async () => {
        await router.navigate('/signin');
      },
    );

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const user = userEvent.setup();
    const signIn = await screen.findByRole('button', { name: 'Sign in' });

    await waitFor(
      /** Waits for settled anonymous bootstrap, not an arbitrary timer. */ () => {
        expect(signIn).toBeEnabled();
      },
    );

    await user.type(screen.getByRole('textbox', { name: 'Email' }), fixture.email);
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'fixture-password');
    await user.click(signIn);

    expect(await screen.findByText('Email confirmation is required')).toBeInTheDocument();
    const resend = await screen.findByRole('link', { name: 'Request another confirmation email' });
    expect(resend).toHaveAttribute('href', '/registration-pending');
    expect(getMockSessionUser()).toBeNull();
    expect(await screen.findByRole('textbox', { name: 'Email' })).toHaveValue('');

    await user.click(resend);

    expect(await screen.findByRole('textbox', { name: 'Email' })).toHaveValue('');
    expect(window.location.pathname).toBe('/registration-pending');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(getMockSessionUser()).toBeNull();
    expect(getMockConfirmationToken(fixture.email)).toBe(fixture.token);
  });

  /** Loading bootstrap cannot hide or consume the link; an outage cannot grant product access. */
  it('renders during bootstrap, strips the fragment, and confirms without creating a session', async () => {
    const fixture = pendingAccount();
    const bootstrap = deferred<void>();
    server.use(
      graphql.query(
        'Me',
        /** Holds auth bootstrap independently of the public action. */ async () => {
          await bootstrap.promise;
          return HttpResponse.error();
        },
      ),
    );
    const consume = vi.fn(
      /** Counts dispatch while retaining the typed mock's explicit consume transition. */ ({
        variables,
      }: {
        variables: ConfirmEmailMutationVariables;
      }) => {
        const success = consumeMockConfirmation(variables.input.token);

        return HttpResponse.json<{ data: ConfirmEmailMutation }>({
          data: { confirmEmail: { success } },
        });
      },
    );
    server.use(
      graphql.mutation<ConfirmEmailMutation, ConfirmEmailMutationVariables>(
        'ConfirmEmail',
        consume,
      ),
    );
    const view = await openConfirmation(fixture.token);
    expect(screen.getByRole('button', { name: 'Confirm email' })).toBeEnabled();
    expect(window.location.hash).toBe('');
    expect(window.history.state).not.toEqual(expect.objectContaining({ token: fixture.token }));
    expect(consume).not.toHaveBeenCalled();
    view.rerender(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(consume).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Email confirmed\. Sign in/)).toBeInTheDocument();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(getMockSessionUser()).toBeNull();
    expect(findMockUserByEmail(fixture.email)?.emailVerified).toBe(true);
    bootstrap.resolve();
    await act(
      /** Attempts product navigation after failed bootstrap without weakening its gate. */ async () => {
        await router.navigate('/corrections');
      },
    );
    expect(
      await screen.findByText('Authentication is temporarily unavailable. Please retry.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Correction inbox' })).not.toBeInTheDocument();
  });

  /** Confirmation does not replace the authenticated reviewer even when confirming another account. */
  it('preserves an existing account and clears terminal token state', async () => {
    const reviewer = findMockUserByEmail(defaultMockReviewerCredentials.email)!;
    setMockSessionUser(reviewer.id);
    const fixture = pendingAccount();
    const view = await openConfirmation(fixture.token);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Email confirmed\. Sign in/)).toBeInTheDocument();
    expect(getMockSessionUser()?.id).toBe(reviewer.id);
    view.unmount();
    await openConfirmation(fixture.token);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/This link is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm email' })).not.toBeInTheDocument();
    expect(getMockSessionUser()?.id).toBe(reviewer.id);
  });

  /** Unknown transport outcome is not replayed by remounts or bootstrap; retry is a separate click. */
  it('requires explicit retry after an outage and presents the same absent-link guidance', async () => {
    const fixture = pendingAccount();
    const consume = vi.fn(
      /** Returns a controlled no-response failure without private diagnostics. */ () =>
        HttpResponse.error(),
    );
    server.use(graphql.mutation('ConfirmEmail', consume));
    const view = await openConfirmation(fixture.token);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Confirmation could not be confirmed/)).toBeInTheDocument();
    view.rerender(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(consume).toHaveBeenCalledTimes(1);
    server.resetHandlers();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try confirmation again' }));
    expect(await screen.findByText(/Email confirmed\. Sign in/)).toBeInTheDocument();
    view.unmount();
    await openConfirmation('');
    expect(screen.getByText(/This link is unavailable/)).toBeInTheDocument();
    expect(getMockSessionUser()).toBeNull();
  });

  /** The resend page is public during an auth outage, and unknown addresses remain generic. */
  it('acknowledges resend neutrally and bounds its local UI timer', async () => {
    server.use(
      graphql.query(
        'Me',
        /** Keeps session recovery unavailable while resend remains public. */ () =>
          HttpResponse.error(),
      ),
    );
    await act(
      /** Selects the fixed public pending route. */ async () => {
        await router.navigate('/registration-pending');
      },
    );
    render(<App />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'unknown-fixture@example.test');
    await user.click(screen.getByRole('button', { name: 'Request another confirmation email' }));
    expect(await screen.findByText(/This is not proof of delivery/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Request another confirmation email' }),
    ).toBeDisabled();
    expect(getMockConfirmationToken('unknown-fixture@example.test')).toBeNull();
  });
});
