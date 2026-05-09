import { test, expect } from '@playwright/test';

test('district lead page has a nav bar', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.locator('nav')).toBeVisible();
});

test('district lead nav shows Observations and Map links', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByRole('link', { name: 'Observations' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Map' })).toBeVisible();
});

test('district lead nav does not show Users link', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible();
});

test('sign-out button is present in nav bar on district lead page', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
});
