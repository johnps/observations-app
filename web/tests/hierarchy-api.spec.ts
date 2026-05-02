import { test, expect } from '@playwright/test';

const VALID_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,lead@test.local,Test Worker,Test Village,upsert`;

const MISSING_COLUMN_CSV = `state,district,block,field_worker_name,village_name
TestState,TestDistrict,TestBlock,Test Worker,Test Village`;

const BLANK_FIELD_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,,TestBlock,lead@test.local,Test Worker,Test Village,upsert`;

const INVALID_ACTION_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,lead@test.local,Test Worker,Test Village,delete`;

test('template download returns CSV with correct headers', async ({ request }) => {
  const res = await request.get('/api/hierarchy/template');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const text = await res.text();
  const headers = text.split('\n')[0].trim();
  expect(headers).toBe('state,district,block,block_lead_email,field_worker_name,village_name,action');
});

test('validate returns no errors and a preview for valid CSV', async ({ request }) => {
  const res = await request.post('/api/hierarchy/validate', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.valid).toBe(true);
  expect(body.errors).toHaveLength(0);
  expect(body.preview).toMatchObject({ adds: expect.any(Number), updates: expect.any(Number), removes: expect.any(Number) });
});

test('validate returns error for missing mandatory column', async ({ request }) => {
  const res = await request.post('/api/hierarchy/validate', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(MISSING_COLUMN_CSV) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.valid).toBe(false);
  expect(body.errors.some((e: { message: string }) => e.message.includes('block_lead_email'))).toBe(true);
});

test('validate returns row-level error for blank mandatory field', async ({ request }) => {
  const res = await request.post('/api/hierarchy/validate', {
  multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(BLANK_FIELD_CSV) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.valid).toBe(false);
  expect(body.errors.some((e: { row: number }) => e.row === 2)).toBe(true);
});

test('validate returns error for invalid action value', async ({ request }) => {
  const res = await request.post('/api/hierarchy/validate', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(INVALID_ACTION_CSV) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.valid).toBe(false);
  expect(body.errors.some((e: { message: string }) => e.message.toLowerCase().includes('action'))).toBe(true);
});

test('upload adds rows and is idempotent', async ({ request }) => {
  // First upload
  const res1 = await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) } },
  });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.added + body1.updated).toBeGreaterThanOrEqual(1);

  // Second upload — same CSV, must be idempotent
  const res2 = await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) } },
  });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.added).toBe(0); // already exists, so update not add

  // Cleanup — remove test row
  const removeCSV = VALID_CSV.replace(',upsert', ',remove');
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(removeCSV) } },
  });
});

test('upload with remove action soft-deletes the row', async ({ request }) => {
  // Seed
  await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(VALID_CSV) } },
  });

  // Remove
  const removeCSV = VALID_CSV.replace(',upsert', ',remove');
  const res = await request.post('/api/hierarchy/upload', {
    multipart: { file: { name: 'hierarchy.csv', mimeType: 'text/csv', buffer: Buffer.from(removeCSV) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.removed).toBeGreaterThanOrEqual(1);
});
