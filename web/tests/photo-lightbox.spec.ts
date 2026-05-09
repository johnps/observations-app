import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const SEED_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,test-block-lead@placeholder.local,Test Worker A,Village Alpha,upsert`;

const PHOTO_OBS_ID = uuidv4();

test.beforeAll(async ({ request }) => {
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'h.csv', mimeType: 'text/csv', buffer: Buffer.from(SEED_CSV) } },
  });
  await request.post('/api/observations', {
    data: {
      id: PHOTO_OBS_ID,
      text: 'Observation with photos',
      field_worker_name: 'Test Worker A',
      village_name: 'Village Alpha',
      block_lead_email: 'test-block-lead@placeholder.local',
      photo_urls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      submitted_at: new Date().toISOString(),
    },
  });
});

test('GET /api/observations includes photo_urls in response', async ({ request }) => {
  const res = await request.get(
    '/api/observations?block_lead_email=test-block-lead@placeholder.local'
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  const obs = body.observations.find((o: { id: string }) => o.id === PHOTO_OBS_ID);
  expect(obs).toBeDefined();
  expect(Array.isArray(obs.photo_urls)).toBe(true);
  expect(obs.photo_urls).toContain('https://example.com/photo1.jpg');
});

// Use state-lead drill-down URL — bypasses the session auth guard, loads observations directly.
const PAGE_URL = '/district-lead/observations?from=state-lead&district=TestDistrict';

test('expanded row shows thumbnails when observation has photos', async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.getByText('Observation with photos').first().click();
  await expect(page.locator('img[data-testid="photo-thumb"]').first()).toBeVisible();
});

test('clicking a thumbnail opens the lightbox', async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.getByText('Observation with photos').first().click();
  await page.locator('img[data-testid="photo-thumb"]').first().click();
  await expect(page.locator('[data-testid="lightbox"]')).toBeVisible();
});

test('lightbox shows a counter and Escape closes it', async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.getByText('Observation with photos').first().click();
  await page.locator('img[data-testid="photo-thumb"]').first().click();
  await expect(page.locator('[data-testid="lightbox-counter"]')).toContainText('1 of 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="lightbox"]')).not.toBeVisible();
});
