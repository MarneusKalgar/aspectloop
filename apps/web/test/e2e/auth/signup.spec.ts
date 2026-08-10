import { defaultMockReviewerCredentials } from '@app/mocks/fixtures/default-reviewer';
import { expect, test } from '@playwright/test';

test('new reviewer can sign up and is redirected to sign in', async ({ page }) => {
  const uniqueEmail = `reviewer-${Date.now()}@example.test`;

  await page.goto('/signup');

  await page.getByRole('textbox', { name: 'Display name' }).fill('New Reviewer');
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail);
  await page.locator('input[name="password"]').fill(defaultMockReviewerCredentials.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText('Account created. Sign in to continue.')).toBeVisible();
});
