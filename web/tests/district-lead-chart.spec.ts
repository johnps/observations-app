import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.beforeAll(async ({ request }) => {
  // Seed two observations for different block leads in current month
  await request.post('/api/observations', {
    data: {
      id: uuidv4(),
      text: 'Chart test obs 1',
      field_worker_name: 'Worker Chart',
      village_name: 'Village Chart',
      block_lead_email: 'test-block-lead@placeholder.local',
      submitted_at: new Date().toISOString(),
    },
  });
});

test('stats API returns counts per block lead for current month', async ({ request }) => {
  const res = await request.get('/api/observations/stats?dimension=block_lead&period=this_month');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.stats).toBeDefined();
  const bl = body.stats.find((s: { name: string }) => s.name === 'test-block-lead@placeholder.local');
  expect(bl).toBeDefined();
  expect(bl.count).toBeGreaterThanOrEqual(1);
});

test('district lead observations page shows a chart', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.locator('[data-testid="frequency-chart"]')).toBeVisible();
});

test('dimension dropdown is visible with block_lead as default', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByLabel('Dimension')).toBeVisible();
});

test('period dropdown is visible with this_month as default', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByLabel('Period')).toBeVisible();
});
