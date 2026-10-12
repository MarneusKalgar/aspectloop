import { type BrowserContext, expect, test } from '@playwright/test';

interface RegistrationRequest {
  operationName: string;
  variables?: {
    input?: { displayName?: string; email?: string; password?: string; token?: string };
  };
}

const FIXTURE_TOKEN = `7af8ba5c-3798-49b1-9db5-a27483e147bd.${'A'.repeat(43)}`;
const FIXTURE_EMAIL = 'confirmation-browser@example.test';
const FIXTURE_PASSWORD = 'mock-password';

/** Installs a test-local contract across document reloads; this is not real cookie/delivery evidence. */
async function registrationContract(context: BrowserContext) {
  const state = {
    confirms: 0,
    outage: false,
    registered: false,
    resends: 0,
    signedIn: false,
    token: FIXTURE_TOKEN,
    verified: false,
  };
  const user = {
    __typename: 'User',
    createdAt: '2026-10-10T00:00:00.000Z',
    displayName: 'Pending Reviewer',
    email: FIXTURE_EMAIL,
    id: 'mock-pending',
    roles: ['CORRECTOR'],
    scopes: ['corrections:write'],
    updatedAt: '2026-10-10T00:00:00.000Z',
  };

  await context.exposeBinding(
    '__registrationContract',
    /** Counts only safe labels and models explicit consume and generic suppression. */
    (_source, request: RegistrationRequest) => {
      if (request.operationName === 'ConfirmEmail') {
        state.confirms += 1;

        if (state.outage) {
          throw new Error('Controlled mock outage');
        }

        if (!state.token || request.variables?.input?.token !== state.token) {
          return {
            errors: [
              {
                extensions: { code: 'AUTH_CONFIRMATION_INVALID' },
                message: 'Confirmation link is unavailable',
              },
            ],
          };
        }

        state.token = '';
        state.verified = true;

        return { data: { confirmEmail: { success: true } } };
      }

      if (request.operationName === 'SignUp') {
        state.registered = true;
        return { data: { signUp: { success: true } } };
      }

      if (request.operationName === 'ResendEmailConfirmation') {
        state.resends += 1;
        return { data: { resendEmailConfirmation: { success: true } } };
      }

      if (request.operationName === 'SignIn') {
        if (!state.verified) {
          return {
            errors: [
              {
                extensions: { code: 'AUTH_EMAIL_UNVERIFIED' },
                message: 'Email confirmation is required',
              },
            ],
          };
        }

        state.signedIn = true;
        return { data: { signIn: { user } } };
      }

      if (request.operationName === 'Me') {
        return state.signedIn
          ? { data: { me: user } }
          : {
              errors: [
                {
                  extensions: { code: 'AUTH_SESSION_INVALID' },
                  message: 'Browser session is invalid',
                },
              ],
            };
      }

      if (request.operationName === 'CorrectionSessions') {
        return { data: { correctionSessions: [] } };
      }

      if (request.operationName === 'SignOut') {
        state.signedIn = false;
        return { data: { signOut: { success: true } } };
      }

      throw new Error('Unexpected fixture operation');
    },
  );

  await context.addInitScript(
    /** Intercepts only test GraphQL calls; native asset fetch and application coordinator remain real. */
    () => {
      const nativeFetch = window.fetch.bind(window);
      const bridge = window as typeof window & {
        __registrationContract: (request: RegistrationRequest) => Promise<unknown>;
      };

      /** Sends fixture requests through the per-context test boundary, not an application debug API. */
      window.fetch = async (input, options) => {
        const url = input instanceof Request ? input.url : String(input);

        if (new URL(url, location.href).pathname !== '/graphql') {
          return nativeFetch(input, options);
        }

        const raw =
          typeof options?.body === 'string'
            ? options.body
            : input instanceof Request
              ? await input.clone().text()
              : '';
        const response = await bridge.__registrationContract(
          JSON.parse(raw) as RegistrationRequest,
        );

        return new Response(JSON.stringify(response), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      };
    },
  );

  return state;
}

/** Verifies browser startup removal, explicit consume, and separate sign-in with a mocked contract. */
test('registration stays pending until explicit confirmation and separate sign-in', async ({
  context,
  page,
}) => {
  const state = await registrationContract(context);
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Display name' }).fill('Pending Reviewer');
  await page.getByRole('textbox', { name: 'Email' }).fill(FIXTURE_EMAIL);
  await page.locator('input[name="password"]').fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/registration-pending$/);
  expect(state.signedIn).toBe(false);
  await page.goto(`/confirm-email#token=${FIXTURE_TOKEN}`);
  await expect(page.getByRole('button', { name: 'Confirm email' })).toBeVisible();
  await expect(page).toHaveURL(/\/confirm-email$/);
  expect(state.confirms).toBe(0);
  const secretAbsent = await page.evaluate(
    /** Returns only fixture-token absence, never stored values. */ (token) =>
      ![
        JSON.stringify(localStorage),
        JSON.stringify(sessionStorage),
        JSON.stringify(history.state),
      ].some(
        /** Compares fixture bytes locally without exporting storage contents. */ (value) =>
          value.includes(token),
      ),
    FIXTURE_TOKEN,
  );
  expect(secretAbsent).toBe(true);
  await page.getByRole('button', { name: 'Confirm email' }).dblclick();
  await expect(page.getByText(/Email confirmed\. Sign in/)).toBeVisible();
  expect(state.confirms).toBe(1);
  expect(state.signedIn).toBe(false);
  await page.getByRole('link', { exact: true, name: 'Sign in' }).last().click();
  await page.getByRole('textbox', { name: 'Email' }).fill(FIXTURE_EMAIL);
  await page.locator('input[name="password"]').fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Correction inbox' })).toBeVisible();
  await page.goto(`/confirm-email#token=${FIXTURE_TOKEN}`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText(/This link is unavailable/)).toBeVisible();
  expect(state.signedIn).toBe(true);
});

/** Dependency errors never trigger replay, and reloading a sanitized link loses its private capture. */
test('unknown confirmation requires an explicit retry; reload never consumes', async ({
  context,
  page,
}) => {
  const state = await registrationContract(context);
  state.outage = true;
  await page.goto(`/confirm-email#token=${FIXTURE_TOKEN}`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText(/Confirmation could not be confirmed/)).toBeVisible();
  expect(state.confirms).toBe(1);
  state.outage = false;
  await page.getByRole('button', { name: 'Try confirmation again' }).click();
  await expect(page.getByText(/Email confirmed\. Sign in/)).toBeVisible();
  expect(state.confirms).toBe(2);
  await page.reload();
  await expect(page.getByText(/This link is unavailable/)).toBeVisible();
  expect(state.confirms).toBe(2);
});

/** Unavailable links share neutral guidance; malformed startup capture uses a fresh document. */
test('unavailable links and resend remain generic with local repeat suppression', async ({
  context,
  page,
}) => {
  const state = await registrationContract(context);
  state.token = 'replacement.mock_secret';
  await page.goto(`/confirm-email#token=${FIXTURE_TOKEN}`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText(/This link is unavailable/)).toBeVisible();
  await page.getByRole('link', { name: 'Request another confirmation email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('unknown-fixture@example.test');
  await page.getByRole('button', { name: 'Request another confirmation email' }).click();
  await expect(page.getByText(/This is not proof of delivery/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Request another confirmation email' }),
  ).toBeDisabled();
  expect(state.resends).toBe(1);
  state.token = '';
  await page.goto(`/confirm-email#token=${FIXTURE_TOKEN}`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText(/This link is unavailable/)).toBeVisible();

  // Leave the path first: changing only its hash would not rerun startup capture.
  await page.goto('/registration-pending');
  const beforeMalformed = state.confirms;
  await page.goto('/confirm-email#token=%00');
  await expect(page.getByText(/This link is unavailable/)).toBeVisible();
  await expect(page).toHaveURL(/\/confirm-email$/);
  expect(state.confirms).toBe(beforeMalformed);
});
