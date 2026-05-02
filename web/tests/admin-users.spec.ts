import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/users');
});

test('admin users page lists all seeded placeholder accounts', async ({ page }) => {
  await expect(page.getByText('test-admin@placeholder.local')).toBeVisible();
  await expect(page.getByText('test-district-lead@placeholder.local')).toBeVisible();
  await expect(page.getByText('test-block-lead@placeholder.local')).toBeVisible();
  await expect(page.getByText('test-state-lead@placeholder.local')).toBeVisible();
});

test('admin can add a new user and see them in the list', async ({ page }) => {
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Email').fill('new-user@test.local');
  await page.getByLabel('Role').selectOption('admin');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('new-user@test.local')).toBeVisible();

  // Cleanup — revoke the user we just added
  const row = page.locator('tr', { hasText: 'new-user@test.local' });
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('new-user@test.local')).not.toBeVisible();
});

test('admin can revoke an existing user and they disappear from the list', async ({ page }) => {
  // Add a user to revoke
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Email').fill('to-revoke@test.local');
  await page.getByLabel('Role').selectOption('admin');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('to-revoke@test.local')).toBeVisible();

  const row = page.locator('tr', { hasText: 'to-revoke@test.local' });
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('to-revoke@test.local')).not.toBeVisible();
});
