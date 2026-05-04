import { validateHierarchyCSV, applyHierarchyCSV } from '../lib/hierarchy';

jest.mock('../lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      data: [],
    }),
  },
}));

const VALID_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,lead@test.local,Test Worker,Test Village,upsert`;

const MISSING_COLUMN_CSV = `state,district,block,field_worker_name,village_name
TestState,TestDistrict,TestBlock,Test Worker,Test Village`;

const BLANK_FIELD_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,,TestBlock,lead@test.local,Test Worker,Test Village,upsert`;

const INVALID_ACTION_CSV = `state,district,block,block_lead_email,field_worker_name,village_name,action
TestState,TestDistrict,TestBlock,lead@test.local,Test Worker,Test Village,delete`;

// ─── validateHierarchyCSV ────────────────────────────────────────────────────

test('validateHierarchyCSV returns valid:false and preview:null for missing column', async () => {
  const result = await validateHierarchyCSV(MISSING_COLUMN_CSV);
  expect(result.valid).toBe(false);
  expect(result.preview).toBeNull();
  expect(result.errors.some(e => e.message.includes('block_lead_email'))).toBe(true);
});

test('validateHierarchyCSV returns valid:false for blank mandatory field', async () => {
  const result = await validateHierarchyCSV(BLANK_FIELD_CSV);
  expect(result.valid).toBe(false);
  expect(result.preview).toBeNull();
  expect(result.errors.some(e => e.row === 2)).toBe(true);
});

test('validateHierarchyCSV returns valid:false for invalid action value', async () => {
  const result = await validateHierarchyCSV(INVALID_ACTION_CSV);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => e.message.toLowerCase().includes('action'))).toBe(true);
});

test('validateHierarchyCSV returns valid:true with a preview object for valid CSV', async () => {
  const supabaseAdmin = require('../lib/supabase-admin').supabaseAdmin;
  supabaseAdmin.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [] }),
  });

  const result = await validateHierarchyCSV(VALID_CSV);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(result.preview).toMatchObject({ adds: expect.any(Number), updates: expect.any(Number), removes: expect.any(Number) });
});

// ─── applyHierarchyCSV ───────────────────────────────────────────────────────

test('applyHierarchyCSV throws for invalid CSV', async () => {
  await expect(applyHierarchyCSV(MISSING_COLUMN_CSV)).rejects.toThrow('Invalid CSV');
});
