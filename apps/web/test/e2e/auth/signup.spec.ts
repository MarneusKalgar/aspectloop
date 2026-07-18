import { expect, test } from '@playwright/test';

test('new reviewer can sign up and is redirected to sign in', async ({ page }) => {
  const uniqueEmail = `reviewer-${Date.now()}@elemika.io`;

  await page.goto('/signup');

  await page.getByRole('textbox', { name: 'Display name' }).fill('New Reviewer');
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail);
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText('Account created. Sign in to continue.')).toBeVisible();
});
