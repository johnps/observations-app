import { getSessionRole } from '../lib/getSessionRole';

var mockGetSession: jest.Mock;
jest.mock('../lib/supabase', () => {
  mockGetSession = jest.fn();
  return { supabase: { auth: { getSession: mockGetSession } } };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns role and district_name when session exists and role API responds', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com' } } },
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ role: 'district_lead', district_name: 'Latehar' }),
  });

  const result = await getSessionRole();

  expect(result).toEqual({ role: 'district_lead', district_name: 'Latehar' });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/users/role?email=lead%40example.com'
  );
});

test('returns null role when session is null', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null });
  expect(mockFetch).not.toHaveBeenCalled();
});

test('returns null role when role API returns non-ok', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com' } } },
  });
  mockFetch.mockResolvedValue({ ok: false });

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null });
});

test('returns null role when fetch throws', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com' } } },
  });
  mockFetch.mockRejectedValue(new Error('network error'));

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null });
});
