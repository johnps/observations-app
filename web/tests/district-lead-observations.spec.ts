import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

test.beforeAll(async ({ request }) => {
  await request.post('/api/observations', {
    data: {
      id: uuidv4(),
      text: 'Visited kitchen garden setup',
      field_worker_name: 'Test Worker A',
      village_name: 'Village Alpha',
      block_lead_email: 'test-block-lead@placeholder.local',
      gps_lat: 26.9124,
      gps_lng: 75.7873,
      submitted_at: new Date().toISOString(),
    },
  });
});

test('district lead observations page shows submitted observations', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByText('Visited kitchen garden setup').first()).toBeVisible();
});

test('observations table shows GPS flag for each row', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.locator('text=✅').or(page.locator('text=🚩')).first()).toBeVisible();
});

test('observations table shows field worker and village', async ({ page }) => {
  await page.goto('/district-lead/observations');
  await expect(page.getByText('Test Worker A').first()).toBeVisible();
  await expect(page.getByText('Village Alpha').first()).toBeVisible();
});
