import { test, expect } from '@playwright/test';

test('state lead stats API returns district counts', async ({ request }) => {
  const res = await request.get('/api/state-lead/stats');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.stats)).toBe(true);
});

test('state lead stats API returns block lead counts when district is specified', async ({ request }) => {
  // Use a district that exists in the seeded hierarchy
  const res = await request.get('/api/state-lead/stats?district=Test%20District');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body.stats)).toBe(true);
});

test('state lead page renders a chart', async ({ page }) => {
  await page.goto('/state-lead');
  await expect(page.locator('[data-testid="state-chart"]')).toBeVisible();
});

test('state lead page has period filter', async ({ page }) => {
  await page.goto('/state-lead');
  await expect(page.getByLabel('Period')).toBeVisible();
});
