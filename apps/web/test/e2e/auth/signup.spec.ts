import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { expect, test } from '@playwright/test';

/** Keeps new mock accounts unverified after neutral signup and directs explicit resend recovery. */
test('new reviewer receives generic signup acceptance but cannot sign in unverified', async ({
  page,
}) => {
  const uniqueEmail = `reviewer-${Date.now()}@example.test`;

  await page.goto('/signup');

  await page.getByRole('textbox', { name: 'Display name' }).fill('New Reviewer');
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail);
  await page.locator('input[name="password"]').fill(defaultMockReviewerCredentials.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/registration-pending$/);
  await expect(
    page.getByText('If confirmation is needed, check your email before signing in.'),
  ).toBeVisible();

  await page.getByRole('link', { exact: true, name: 'Sign in' }).last().click();

  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail);
  await page.locator('input[name="password"]').fill(defaultMockReviewerCredentials.password);
  await page.getByRole('button', { exact: true, name: 'Sign in' }).click();
  await expect(page.getByText('Email confirmation is required')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Request another confirmation email' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signin$/);
});
