import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const obsId = uuidv4();

test.beforeAll(async ({ request }) => {
  await request.post('/api/observations', {
    data: {
      id: obsId,
      text: 'Visited kitchen garden, helped the family plant tomatoes and set up drip irrigation',
      field_worker_name: 'Tag Test Worker',
      village_name: 'Tag Test Village',
      block_lead_email: 'test-block-lead@placeholder.local',
      submitted_at: new Date().toISOString(),
    },
  });
});

test('POST /api/observations/tag returns tagged count', async ({ request }) => {
  const res = await request.post('/api/observations/tag');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.tagged).toBe('number');
  expect(typeof body.total).toBe('number');
  expect(body.total).toBeGreaterThanOrEqual(1);
});

test('tagged observation has non-empty tags array', async ({ request }) => {
  // Run tagging if not already run
  await request.post('/api/observations/tag');

  const res = await request.get(`/api/observations/by-id/${obsId}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.tags).toBeDefined();
  expect(Array.isArray(body.tags)).toBe(true);
  expect(body.tags.length).toBeGreaterThan(0);
});
