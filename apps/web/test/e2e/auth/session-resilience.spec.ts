import { SESSION_MARKER_KEY } from '@app/auth/session-coordination/session-marker';
import { deferred } from '@app/test/session-environment';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

interface MockSessionRequest {
  operationName: string;
  variables?: { input?: { email: string; password: string } };
}

const ACCOUNT_A = {
  __typename: 'User',
  createdAt: '2026-10-04T00:00:00.000Z',
  displayName: 'Account Alpha',
  email: 'alpha@example.test',
  id: '2d9a53b5-b80c-4303-8bfc-81b317f09260',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: '2026-10-04T00:00:00.000Z',
};
const ACCOUNT_B = {
  ...ACCOUNT_A,
  displayName: 'Account Beta',
  email: 'beta@example.test',
  id: '6b7442ce-9fe4-41b8-9068-549cd1a64d2e',
};

/** Enters only public mock credentials; production fixtures never appear in test source or traces. */
async function fillLogin(page: Page, email: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.locator('input[name="password"]').fill('mock-password');
}

/** Uses one explicitly mocked server across pages; native Locks/events are real, cookies are not. */
async function installSharedContract(context: BrowserContext) {
  const state = {
    activeActions: 0,
    current: null as null | typeof ACCOUNT_A,
    delaySignIn: null as null | Promise<void>,
    maxActions: 0,
    requests: [] as string[],
    signInStarted: deferred<void>(),
    unreachable: false,
  };
  await context.exposeBinding(
    '__sessionContract',
    /** Simulates contract responses centrally instead of relying on MSW's worker-local sessions. */
    async (_source, request: MockSessionRequest) => {
      state.requests.push(request.operationName);
      if (state.unreachable) {
        throw new TypeError('Controlled mock transport outage');
      }
      const cookieAction =
        request.operationName === 'SignIn' || request.operationName === 'SignOut';

      if (cookieAction) {
        state.activeActions += 1;
        state.maxActions = Math.max(state.maxActions, state.activeActions);
      }

      try {
        if (request.operationName === 'SignIn') {
          state.signInStarted.resolve();
          if (state.delaySignIn) {
            await state.delaySignIn;
          }
          state.current =
            request.variables?.input?.email === ACCOUNT_B.email ? ACCOUNT_B : ACCOUNT_A;
          return { data: { signIn: { __typename: 'SignInPayload', user: state.current } } };
        }

        if (request.operationName === 'SignOut') {
          state.current = null;
          return { data: { signOut: { __typename: 'SignOutPayload', success: true } } };
        }

        if (request.operationName === 'Me') {
          return state.current
            ? { data: { me: state.current } }
            : {
                data: null,
                errors: [
                  { extensions: { code: 'AUTH_SESSION_INVALID' }, message: 'Session is invalid' },
                ],
              };
        }

        if (request.operationName === 'CorrectionSessions') {
          return { data: { correctionSessions: [] } };
        }

        throw new Error('Unexpected operation in the scoped mock contract');
      } finally {
        if (cookieAction) {
          state.activeActions -= 1;
        }
      }
    },
  );
  await context.addInitScript(
    /** Intercepts only application GraphQL fetches before MSW; all assets use native fetch. */
    () => {
      const nativeFetch = window.fetch.bind(window);
      const bridge = window as typeof window & {
        __sessionContract: (request: MockSessionRequest) => Promise<unknown>;
      };
      /** This bridge deliberately models responses, not browser-managed HttpOnly cookie processing. */
      window.fetch = async (input, options) => {
        const url = input instanceof Request ? input.url : String(input);
        if (new URL(url, location.href).pathname !== '/graphql') {
          return nativeFetch(input, options);
        }
        const body =
          typeof options?.body === 'string'
            ? options.body
            : input instanceof Request
              ? await input.clone().text()
              : '';
        const request = JSON.parse(body) as MockSessionRequest;
        const response = await bridge.__sessionContract(request);
        return new Response(JSON.stringify(response), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      };
    },
  );
  return state;
}

/** Reads only the bounded non-secret marker for observable browser assertions. */
async function marker(page: Page) {
  return page.evaluate(
    /** Extracts this one approved coordination key, not the browser's complete storage. */
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? 'null') as null | {
        action: null | { status: string };
        logoutIntent: boolean;
        revocation: string;
      },
    SESSION_MARKER_KEY,
  );
}

test('mock contract: two tabs retire account A and validate account B independently' /** Exercises actual browser Locks, shared storage and peer notifications with a controlled contract server. */, async ({
  context,
  page,
}) => {
  const state = await installSharedContract(context);
  const peer = await context.newPage();
  await page.goto('/signin');
  await peer.goto('/signin');
  await fillLogin(page, ACCOUNT_A.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Correction inbox' })).toBeVisible();
  await expect(peer.getByRole('button', { name: /Account Alpha/ })).toBeVisible();
  await page.getByRole('button', { name: /Account Alpha/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(peer.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(
    state.requests.filter(
      /** Peer tabs must not duplicate the user's explicit sign-out request. */
      (name) => name === 'SignOut',
    ),
  ).toHaveLength(1);
  await fillLogin(peer, ACCOUNT_B.email);
  await peer.getByRole('button', { name: 'Sign in' }).click();
  await expect(peer.getByRole('button', { name: /Account Beta/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Account Beta/ })).toBeVisible();
  await expect(page.getByText('Account Alpha')).toHaveCount(0);
  expect(state.maxActions).toBe(1);
  const record = JSON.stringify(await marker(page));
  expect(record).not.toMatch(/alpha|beta|password|email|accessToken|refreshToken/i);
  await peer.close();
});

test('mock contract: peer logout wins against delayed login and dispatches only after it settles' /** Holds an actual cookie-action lock while another tab publishes durable intent. */, async ({
  context,
  page,
}) => {
  const state = await installSharedContract(context);
  const response = deferred<void>();
  state.delaySignIn = response.promise;
  const peer = await context.newPage();
  await page.goto('/signin');
  await peer.goto('/signin');
  await fillLogin(page, ACCOUNT_A.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await state.signInStarted.promise;
  await peer.getByRole('button', { name: 'Sign out locally' }).click();
  await expect
    .poll(
      /** Waits for the durable record rather than a fixed UI/network delay. */
      async () => (await marker(page))?.logoutIntent,
    )
    .toBe(true);
  expect(state.requests).not.toContain('SignOut');
  response.resolve();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(peer.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(
    state.requests.filter(
      /** Confirms exactly one explicit revocation after the delayed login acknowledgement. */
      (name) => name === 'SignOut',
    ),
  ).toHaveLength(1);
  expect(state.maxActions).toBe(1);
  expect(await marker(page)).toMatchObject({
    action: null,
    logoutIntent: true,
    revocation: 'confirmed',
  });
  await expect(peer.getByText('Account Alpha')).toHaveCount(0);
  await peer.close();
});

test('mock contract: unknown logout stays blocked across reload without an automatic Me' /** Models a rejected transport promise; it does not claim that a browser cookie was removed. */, async ({
  context,
  page,
}) => {
  const state = await installSharedContract(context);
  state.current = ACCOUNT_A;
  await page.goto('/corrections');
  await page.getByRole('button', { name: /Account Alpha/ }).click();
  state.unreachable = true;
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByText(/An account action is unresolved/)).toBeVisible();
  expect(await marker(page)).toMatchObject({ action: { status: 'unknown' }, logoutIntent: true });
  state.unreachable = false;
  const requestsBeforeReload = state.requests.length;
  await page.reload();
  await expect(page.getByText(/An account action is unresolved/)).toBeVisible();
  expect(state.requests).toHaveLength(requestsBeforeReload);
  await expect(page.getByRole('button', { name: 'Retry sign out' })).toHaveCount(0);
  await expect(page.getByText('Account Alpha')).toHaveCount(0);
});

test('mock contract: closing the action owner makes its pending record unknown, never a new login permission' /** Native document termination releases the lock, but the peer cannot infer remote rollback. */, async ({
  context,
  page,
}) => {
  const state = await installSharedContract(context);
  const response = deferred<void>();
  state.delaySignIn = response.promise;
  const peer = await context.newPage();
  await page.goto('/signin');
  await peer.goto('/signin');
  await fillLogin(page, ACCOUNT_A.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await state.signInStarted.promise;
  await expect(peer.getByRole('button', { name: 'Sign out locally' })).toBeVisible();
  await page.close();
  await expect(peer.getByText(/An account action is unresolved/)).toBeVisible();
  response.resolve();
  await expect
    .poll(
      /** Confirms that even eventual mocked server completion cannot clear the orphan marker. */
      async () => (await marker(peer))?.action?.status,
    )
    .toBe('unknown');
  expect(state.requests).not.toContain('SignOut');
  await peer.close();
});

test('mock contract: unsupported Locks allow existing reads but keep logout local across reload' /** Uses a browser without the native capability rather than a production fallback mutex. */, async ({
  context,
  page,
}) => {
  const state = await installSharedContract(context);
  state.current = ACCOUNT_A;
  await context.addInitScript(
    /** Removes account-action capability before either provider or transport is constructed. */
    () => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }),
  );
  await page.goto('/corrections');
  await page.getByRole('button', { name: /Account Alpha/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByText(/server revocation could not be confirmed/)).toBeVisible();
  expect(state.requests).not.toContain('SignOut');
  const requestsBeforeReload = state.requests.length;
  await page.reload();
  await expect(page.getByText(/server revocation could not be confirmed/)).toBeVisible();
  expect(state.requests).toHaveLength(requestsBeforeReload);
  await expect(page.getByText('Account Alpha')).toHaveCount(0);
});
