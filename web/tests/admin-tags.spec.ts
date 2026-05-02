import { test, expect } from '@playwright/test';

test('admin tags page lists seeded tags', async ({ page }) => {
  await page.goto('/admin/tags');
  await expect(page.getByText('kitchen_garden').first()).toBeVisible();
});

test('admin can add a new tag and see it in the list', async ({ page }) => {
  await page.goto('/admin/tags');
  await page.getByPlaceholder('Tag name').fill('test_tag_e2e');
  await page.getByPlaceholder('Description').fill('E2E test tag');
  await page.getByRole('button', { name: 'Add Tag' }).click();
  await expect(page.getByText('test_tag_e2e').first()).toBeVisible();
});

test('admin can delete a tag', async ({ page }) => {
  // First add one to delete
  await page.goto('/admin/tags');
  await page.getByPlaceholder('Tag name').fill('tag_to_delete');
  await page.getByPlaceholder('Description').fill('Will be deleted');
  await page.getByRole('button', { name: 'Add Tag' }).click();
  await expect(page.getByText('tag_to_delete').first()).toBeVisible();

  // Delete it
  const row = page.locator('tr', { hasText: 'tag_to_delete' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('tag_to_delete')).not.toBeVisible();
});

test('tags API GET returns all tags', async ({ request }) => {
  const res = await request.get('/api/tags');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.tags)).toBe(true);
  expect(body.tags.length).toBeGreaterThan(0);
  expect(body.tags[0]).toHaveProperty('name');
  expect(body.tags[0]).toHaveProperty('description');
});
