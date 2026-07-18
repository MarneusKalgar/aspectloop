import { expect, test } from '@playwright/test';

test('reviewer can sign in from the public auth flow', async ({ page }) => {
  await page.goto('/signin');

  await page.getByRole('textbox', { name: 'Email' }).fill('reviewer@elemika.io');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/corrections$/);

  await expect(page.getByText('Correction inbox').first()).toBeVisible();
});
