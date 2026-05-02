import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const SEED_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,test-block-lead@placeholder.local,Test Worker A,Village Alpha,upsert
TestState,TestDistrict,TestBlock,test-block-lead@placeholder.local,Test Worker A,Village Beta,upsert
TestState,TestDistrict,TestBlock,test-block-lead@placeholder.local,Test Worker B,Village Gamma,upsert`;

test.beforeAll(async ({ request }) => {
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'h.csv', mimeType: 'text/csv', buffer: Buffer.from(SEED_CSV) } },
  });
});

test.afterAll(async ({ request }) => {
  const remove = SEED_CSV.replace(/,upsert/g, ',remove');
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'h.csv', mimeType: 'text/csv', buffer: Buffer.from(remove) } },
  });
});

test('field-workers returns workers for a block lead', async ({ request }) => {
  const res = await request.get(
    '/api/hierarchy/field-workers?block_lead_email=test-block-lead@placeholder.local'
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  const names = body.field_workers.map((w: { field_worker_name: string }) => w.field_worker_name);
  expect(names).toContain('Test Worker A');
  expect(names).toContain('Test Worker B');
});

test('villages returns villages for a field worker', async ({ request }) => {
  const res = await request.get(
    '/api/hierarchy/villages?block_lead_email=test-block-lead@placeholder.local&field_worker_name=Test Worker A'
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  const names = body.villages.map((v: { village_name: string }) => v.village_name);
  expect(names).toContain('Village Alpha');
  expect(names).toContain('Village Beta');
  expect(names).not.toContain('Village Gamma');
});

test('POST /api/observations creates an observation with GPS', async ({ request }) => {
  const id = uuidv4();
  const res = await request.post('/api/observations', {
    data: {
      id,
      text: 'Test observation text',
      field_worker_name: 'Test Worker A',
      village_name: 'Village Alpha',
      block_lead_email: 'test-block-lead@placeholder.local',
      gps_lat: 26.9124,
      gps_lng: 75.7873,
      submitted_at: new Date().toISOString(),
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(id);
  expect(body.gps_captured).toBe(true);
});

test('POST /api/observations sets gps_captured false when no coords', async ({ request }) => {
  const id = uuidv4();
  const res = await request.post('/api/observations', {
    data: {
      id,
      text: 'No GPS observation',
      field_worker_name: 'Test Worker A',
      village_name: 'Village Alpha',
      block_lead_email: 'test-block-lead@placeholder.local',
      submitted_at: new Date().toISOString(),
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.gps_captured).toBe(false);
});

test('POST /api/observations is idempotent on uuid', async ({ request }) => {
  const id = uuidv4();
  const payload = {
    id,
    text: 'Idempotency test',
    field_worker_name: 'Test Worker A',
    village_name: 'Village Alpha',
    block_lead_email: 'test-block-lead@placeholder.local',
    submitted_at: new Date().toISOString(),
  };
  await request.post('/api/observations', { data: payload });
  const res2 = await request.post('/api/observations', { data: payload });
  expect(res2.status()).toBe(200);

  const list = await request.get(
    '/api/observations?block_lead_email=test-block-lead@placeholder.local'
  );
  const body = await list.json();
  const matches = body.observations.filter((o: { id: string }) => o.id === id);
  expect(matches).toHaveLength(1);
});

test('GET /api/observations returns observations for a block lead', async ({ request }) => {
  const res = await request.get(
    '/api/observations?block_lead_email=test-block-lead@placeholder.local'
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.observations)).toBe(true);
  expect(body.observations.length).toBeGreaterThanOrEqual(1);
  expect(body.observations[0]).toMatchObject({
    id: expect.any(String),
    text: expect.any(String),
    gps_captured: expect.any(Boolean),
  });
});
