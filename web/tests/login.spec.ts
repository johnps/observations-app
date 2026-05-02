import { test, expect } from '@playwright/test';

test('login page shows Sign in with Google button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
});

test('login page shows app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Livelihood Monitor' })).toBeVisible();
});
