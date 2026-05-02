import { test, expect } from '@playwright/test';

test('login screen shows all four role buttons', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'District Lead' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Block Lead' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'State Lead' })).toBeVisible();
});

test('clicking Admin navigates to admin home screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Admin' }).click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});

test('clicking District Lead navigates to district lead home screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'District Lead' }).click();
  await expect(page).toHaveURL('/district-lead');
  await expect(page.getByRole('heading', { name: 'District Lead' })).toBeVisible();
});

test('clicking Block Lead navigates to block lead home screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Block Lead' }).click();
  await expect(page).toHaveURL('/block-lead');
  await expect(page.getByRole('heading', { name: 'Block Lead' })).toBeVisible();
});

test('clicking State Lead navigates to state lead home screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'State Lead' }).click();
  await expect(page).toHaveURL('/state-lead');
  await expect(page.getByRole('heading', { name: 'State Overview' })).toBeVisible();
});
