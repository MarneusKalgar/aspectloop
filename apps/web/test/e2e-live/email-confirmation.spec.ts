import { expect, type Page } from '@playwright/test';

import {
  confirmedLogout,
  cookieValue,
  identityVisible,
  signIn,
  signOut,
} from './support/browser-assertions';
import { test } from './support/live-fixtures';

const REGISTRATION_DISPLAY_NAME = 'Email browser verification fixture';

/** Opens the intended private mail/action exchange without retaining a credential-bearing navigation error. */
async function openPrivateLink(page: Page, token: string): Promise<void> {
  try {
    await page.goto(`/confirm-email#token=${token}`);
  } catch {
    throw new Error('E2 private link navigation failed; details omitted.');
  }
}

/** Exercises D3 delivery with closed failure stages, explicit recovery and exact parent cleanup. */
test('E2-LIVE-01', async ({ context, live, page }) => {
  const fixture = live.registration;

  if (!fixture) {
    throw new Error('E2 requires its explicitly enabled parent-owned fixture');
  }

  await test.step('SIGN_UP', /** Submits the exact private fixture while reporting only a fixed stage on failure. */ async () => {
    await page.goto('/signup');

    try {
      await page.getByRole('textbox', { name: 'Display name' }).fill(REGISTRATION_DISPLAY_NAME);
      await page.getByRole('textbox', { name: 'Email' }).fill(fixture.email);
      await page.locator('input[name="password"]').fill(fixture.password);
    } catch {
      throw new Error('E2 private signup input failed; details omitted.');
    }

    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByText('If confirmation is needed, check your email before signing in.'),
    ).toBeVisible();
    expect((await cookieValue(context)) === null).toBe(true);
  });

  const link = { id: '', token: '' };
  await test.step('MAIL_CAPTURE', /** Keeps mail-derived credentials in the private closure, never step return metadata. */ async () => {
    Object.assign(link, await fixture.readLink());
  });

  const confirms = live.gate.count('ConfirmEmail');
  await test.step('LINK_CAPTURE', /** Checks startup sanitation without returning the token or automatically consuming it. */ async () => {
    await openPrivateLink(page, link.token);
    await expect(page.getByRole('button', { name: 'Confirm email' })).toBeVisible();
    expect(
      await page.evaluate(
        /** Returns only sanitation evidence, not the captured token. */ () =>
          location.hash === '' && location.search === '',
      ),
    ).toBe(true);
    expect(live.gate.count('ConfirmEmail') === confirms).toBe(true);
  });

  await test.step('OUTAGE_CONFIRMATION', /** Requires one explicit attempt during the owned outage without issuing a cookie. */ async () => {
    await live.stopPlatform();
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page.getByText(/Confirmation could not be confirmed/)).toBeVisible();
    expect(live.gate.count('ConfirmEmail') === confirms + 1).toBe(true);
    expect((await cookieValue(context)) === null).toBe(true);
  });

  await test.step('RESTORE_CONFIRMATION', /** Restores only the owned service; consumption still requires a separate retry click. */ async () => {
    await live.restorePlatform();
    expect(live.gate.count('ConfirmEmail') === confirms + 1).toBe(true);
    await page.getByRole('button', { name: 'Try confirmation again' }).click();
    await expect(page.getByText(/Email confirmed\. Sign in/)).toBeVisible();
    expect(live.gate.count('ConfirmEmail') === confirms + 2).toBe(true);
    expect((await cookieValue(context)) === null).toBe(true);
  });

  const account = { email: fixture.email, id: link.id, password: fixture.password };
  await test.step('SIGN_IN', /** Explicitly signs in the confirmed account; confirmation itself is not login. */ async () => {
    await page.getByRole('link', { exact: true, name: 'Sign in' }).last().click();
    await signIn(page, account);
    await identityVisible(page, account);
    await expect(page.getByText('No correction sessions yet')).toBeVisible();
  });

  await test.step('REUSED_LINK', /** Rejects a consumed link without changing the independent authenticated session. */ async () => {
    const original = await cookieValue(context);
    await openPrivateLink(page, link.token);
    await expect(page.getByRole('button', { name: 'Confirm email' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm email' }).click();
    await expect(page.getByText(/This link is unavailable/)).toBeVisible();
    expect((await cookieValue(context)) === original).toBe(true);
    await page.goto('/corrections');
    await identityVisible(page, account);
  });

  await test.step('SIGN_OUT', /** Requires explicit fixture logout acknowledgement before checking cookies and headers. */ async () => {
    await signOut(page, REGISTRATION_DISPLAY_NAME);
    await confirmedLogout(page);
    expect((await cookieValue(context)) === null).toBe(true);
    expect(
      live.gate.observations
        .filter(
          /** Selects cookie-neutral registration responses without inspecting payloads. */ (
            entry,
          ) => ['ConfirmEmail', 'SignUp'].includes(entry.operation),
        )
        .every(
          /** Checks received headers only, not mail/token bodies. */ (entry) =>
            entry.received && entry.cookieWrites === 0 && entry.noStore && !entry.bearer,
        ),
    ).toBe(true);
  });
});
