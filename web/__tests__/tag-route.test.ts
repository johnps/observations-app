import { POST } from '../app/api/observations/tag/route';

// var is hoisted so the factory can assign it before the import evaluates
var mockMessagesCreate: jest.Mock;
jest.mock('@anthropic-ai/sdk', () => {
  mockMessagesCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  }));
});

jest.mock('next/server', () => ({
  NextResponse: {
    json: (_data: any, _init?: any) => _data,
  },
}));

jest.mock('../lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const { supabaseAdmin } = require('../lib/supabase-admin');

const TAG_DEFS = [{ name: 'livestock', description: 'Livestock activities' }];
const TAG_DEFS_RESULT = { data: TAG_DEFS, error: null };

function mockTagsFrom() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(TAG_DEFS_RESULT),
    }),
  };
}

function mockObsSelectFrom(obsData: { id: string; text: string }[]) {
  return {
    select: jest.fn().mockReturnValue({
      or: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: obsData, error: null }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  };
}

function mockClaudeResponse(tags: string[][]) {
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(tags) }],
  });
}

function makeReq(params: Record<string, string> = {}) {
  return { nextUrl: { searchParams: new URLSearchParams(params) } } as any;
}

function mockHierarchyFrom(emails: string[]) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: emails.map(e => ({ block_lead_email: e })),
          error: null,
        }),
      }),
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Bug 1: filter must include NULL rows ────────────────────────────────────

test('fetches observations where tags is empty array OR null', async () => {
  const mockOr = jest.fn().mockReturnValue({
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  });
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    return { select: jest.fn().mockReturnValue({ or: mockOr }) };
  });

  await POST(makeReq());

  expect(mockOr).toHaveBeenCalledWith('tags.eq.{},tags.is.null');
});

// ─── Bug 2: tagged count reflects successful writes, not Claude's output ─────

test('tagged count excludes observations whose update failed', async () => {
  const obs = [
    { id: 'obs-1', text: 'Field visit' },
    { id: 'obs-2', text: 'Field visit' },
  ];
  mockClaudeResponse([['livestock'], ['livestock']]);

  const mockUpdateEqFailing = jest.fn().mockResolvedValue({ error: { message: 'update failed' } });
  const mockUpdateEqOk     = jest.fn().mockResolvedValue({ error: null });

  // Track at .update() call time, not at from() call time
  let updateCallCount = 0;
  const mockUpdate = jest.fn().mockImplementation(() => ({
    eq: updateCallCount++ === 0 ? mockUpdateEqOk : mockUpdateEqFailing,
  }));

  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    return {
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: obs, error: null }),
        }),
      }),
      update: mockUpdate,
    };
  });

  const result = await POST(makeReq());

  expect((result as any).tagged).toBe(1);
});

// ─── Regression: existing behaviour still works ──────────────────────────────

test('returns tagged:0 total:0 when no untagged observations exist', async () => {
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    return {
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
  });

  const result = await POST(makeReq());

  expect(result).toMatchObject({ tagged: 0, total: 0 });
  expect(mockMessagesCreate).not.toHaveBeenCalled();
});

// ─── Issue 0005: district-scoped tagging ─────────────────────────────────────

test('scoped run resolves block leads for district and filters observations by email', async () => {
  const emails = ['lead1@example.com', 'lead2@example.com'];
  const mockIn = jest.fn().mockReturnValue({
    or: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });

  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    if (table === 'hierarchy') return mockHierarchyFrom(emails);
    return { select: jest.fn().mockReturnValue({ in: mockIn }), update: jest.fn() };
  });

  await POST(makeReq({ district: 'Latehar' }));

  expect(mockIn).toHaveBeenCalledWith('block_lead_email', emails);
});

test('scoped run returns tagged:0 total:0 without calling Claude when district has no block leads', async () => {
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    if (table === 'hierarchy') return mockHierarchyFrom([]);
    return mockObsSelectFrom([]);
  });

  const result = await POST(makeReq({ district: 'Unknown District' }));

  expect(result).toMatchObject({ tagged: 0, total: 0 });
  expect(mockMessagesCreate).not.toHaveBeenCalled();
});

test('global run (no district param) does not query hierarchy table', async () => {
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    if (table === 'hierarchy') throw new Error('hierarchy should not be queried on global run');
    return mockObsSelectFrom([]);
  });

  await expect(POST(makeReq())).resolves.not.toThrow();
});

test('tags valid observations and returns correct counts', async () => {
  const obs = [{ id: 'obs-1', text: 'Visited kitchen garden' }];
  mockClaudeResponse([['livestock']]);
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'tags') return mockTagsFrom();
    return mockObsSelectFrom(obs);
  });

  const result = await POST(makeReq());

  expect((result as any).tagged).toBe(1);
  expect((result as any).total).toBe(1);
});
