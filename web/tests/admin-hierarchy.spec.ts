import { test, expect } from '@playwright/test';

const VALID_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,lead@test.local,Test Worker,Test Village,upsert`;

const INVALID_CSV = `state,district,block,field_worker_name,village_name
TestState,TestDistrict,TestBlock,Test Worker,Test Village`;

test('hierarchy page has upload input and template download link', async ({ page }) => {
  await page.goto('/admin/hierarchy');
  await expect(page.getByRole('link', { name: /download template/i })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeAttached();
});

test('uploading valid CSV shows preview before confirm', async ({ page }) => {
  await page.goto('/admin/hierarchy');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) });
  await expect(page.getByText(/preview/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /confirm/i })).toBeVisible();
});

test('confirming upload shows success message', async ({ page }) => {
  await page.goto('/admin/hierarchy');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) });
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByText(/uploaded/i)).toBeVisible();

  // Cleanup
  const removeCSV = VALID_CSV.replace(',upsert', ',remove');
  await page.goto('/admin/hierarchy');
  await input.setInputFiles({ name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(removeCSV) });
  await page.getByRole('button', { name: /confirm/i }).click();
});

test('uploading invalid CSV shows errors and no confirm button', async ({ page }) => {
  await page.goto('/admin/hierarchy');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(INVALID_CSV) });
  await expect(page.getByText(/block_lead_email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /confirm/i })).not.toBeVisible();
});
