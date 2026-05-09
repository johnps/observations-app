import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const SEED_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,test-block-lead@placeholder.local,Test Worker A,Village Alpha,upsert`;

test.beforeAll(async ({ request }) => {
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'h.csv', mimeType: 'text/csv', buffer: Buffer.from(SEED_CSV) } },
  });
  await request.post('/api/observations', {
    data: {
      id: uuidv4(),
      text: 'GPS observation for map',
      field_worker_name: 'Test Worker A',
      village_name: 'Village Alpha',
      block_lead_email: 'test-block-lead@placeholder.local',
      gps_lat: 26.9124,
      gps_lng: 75.7873,
      submitted_at: new Date().toISOString(),
    },
  });
});

// Use state-lead drill-down pattern to bypass session auth for UI tests
const MAP_URL = '/district-lead/map?from=state-lead&district=TestDistrict';

test('map page renders a leaflet container', async ({ page }) => {
  await page.goto(MAP_URL);
  await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('map page renders filter controls', async ({ page }) => {
  await page.goto(MAP_URL);
  await expect(page.locator('select').first()).toBeVisible();
});

test('map page has TopNav with Observations and Map links', async ({ page }) => {
  await page.goto(MAP_URL);
  await expect(page.getByRole('link', { name: 'Observations' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Map' })).toBeVisible();
});
