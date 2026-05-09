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

test('returns role, district_name, fullName, email when session exists and role API responds', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com', user_metadata: { full_name: 'Priya Sharma' } } } },
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ role: 'district_lead', district_name: 'Latehar' }),
  });

  const result = await getSessionRole();

  expect(result).toEqual({ role: 'district_lead', district_name: 'Latehar', fullName: 'Priya Sharma', email: 'lead@example.com' });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/users/role?email=lead%40example.com'
  );
});

test('returns null role when session is null', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null, fullName: null, email: null });
  expect(mockFetch).not.toHaveBeenCalled();
});

test('returns null role when role API returns non-ok', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com', user_metadata: { full_name: 'Priya Sharma' } } } },
  });
  mockFetch.mockResolvedValue({ ok: false });

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null, fullName: 'Priya Sharma', email: 'lead@example.com' });
});

test('returns null role when fetch throws', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { email: 'lead@example.com', user_metadata: { full_name: 'Priya Sharma' } } } },
  });
  mockFetch.mockRejectedValue(new Error('network error'));

  const result = await getSessionRole();

  expect(result).toEqual({ role: null, district_name: null, fullName: 'Priya Sharma', email: 'lead@example.com' });
});
