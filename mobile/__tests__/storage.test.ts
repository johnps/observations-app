import { uploadPhoto } from '../lib/storage';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-jwt' } }, // no expires_at → skips refresh
      }),
      refreshSession: jest.fn(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
  // Restore default session mock — tests that override it do not clean up after themselves.
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'test-jwt' } },
  });
  supabase.auth.refreshSession.mockResolvedValue({
    data: { session: { access_token: 'refreshed-jwt' } },
    error: null,
  });
});

test('uploadPhoto reads file via fetch, POSTs native blob to Supabase REST with user JWT', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })) })
    .mockResolvedValueOnce({ ok: true });

  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  const [uploadUrl, opts] = (global.fetch as jest.Mock).mock.calls[1];
  expect(uploadUrl).toContain('/storage/v1/object/observation-photos/obs-123/0.jpg');
  expect(opts.method).toBe('POST');
  expect(opts.headers['Authorization']).toBe('Bearer test-jwt');
  expect(opts.headers['x-upsert']).toBe('true');
  expect(url).toContain('/object/public/observation-photos/obs-123/0.jpg');
});

test('uploadPhoto throws with server error message when upload fails and file is not in storage', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'new row violates row-level security policy' }),
    })
    .mockResolvedValueOnce({ ok: false, status: 404 }); // HEAD — file not there

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).rejects.toThrow('Upload failed');
});

test('uploadPhoto sends x-upsert header — safe to retry without duplicate errors', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: true });

  await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  const [, opts] = (global.fetch as jest.Mock).mock.calls[1];
  expect(opts.headers['x-upsert']).toBe('true');
});

test('uploadPhoto throws immediately when session is null — no upload attempted', async () => {
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0))
    .rejects.toThrow('Upload failed: no authenticated session');

  expect(global.fetch).not.toHaveBeenCalled();
});

test('uploadPhoto throws when upload times out', async () => {
  jest.useFakeTimers();
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockImplementation((_url: string, opts: RequestInit) =>
      new Promise((_res, rej) => {
        opts?.signal?.addEventListener('abort', () =>
          rej(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
        );
      })
    );

  const promise = uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);
  const assertion = expect(promise).rejects.toThrow();
  await jest.advanceTimersByTimeAsync(61_000);
  await assertion;
  jest.useRealTimers();
});

// ─── Token refresh (Issue 0010) ──────────────────────────────────────────────

test('uploadPhoto does not refresh token when expires_at is not set', async () => {
  const { supabase } = require('../lib/supabase');
  // Default mock has no expires_at — refresh must not be called
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: true });

  await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
});

test('uploadPhoto does not refresh token when token expires far in the future', async () => {
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'valid-jwt', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
  });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: true });

  await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  const [, opts] = (global.fetch as jest.Mock).mock.calls[1];
  expect(opts.headers['Authorization']).toBe('Bearer valid-jwt');
});

test('uploadPhoto refreshes token and uses new token when within 60s of expiry', async () => {
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'old-jwt', expires_at: Math.floor(Date.now() / 1000) + 30 } },
  });
  supabase.auth.refreshSession.mockResolvedValue({
    data: { session: { access_token: 'refreshed-jwt' } },
    error: null,
  });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: true });

  await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(supabase.auth.refreshSession).toHaveBeenCalled();
  const [, opts] = (global.fetch as jest.Mock).mock.calls[1];
  expect(opts.headers['Authorization']).toBe('Bearer refreshed-jwt');
});

test('uploadPhoto throws when token is near expiry and refresh fails — no upload attempted', async () => {
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'old-jwt', expires_at: Math.floor(Date.now() / 1000) + 30 } },
  });
  supabase.auth.refreshSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'refresh_token_already_used' },
  });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0))
    .rejects.toThrow('Upload failed: no authenticated session');

  expect(global.fetch).not.toHaveBeenCalled();
});

// ─── Already-uploaded handling (Issue 0012) ──────────────────────────────────

test('uploadPhoto returns public URL when file already exists in storage (400 + HEAD ok)', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'new row violates row-level security policy' }),
    })
    .mockResolvedValueOnce({ ok: true }); // HEAD — file is there

  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(url).toContain('/object/public/observation-photos/obs-123/0.jpg');
});

test('uploadPhoto returns public URL when file already exists in storage (409 + HEAD ok)', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'conflict' }),
    })
    .mockResolvedValueOnce({ ok: true }); // HEAD — file is there

  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(url).toContain('/object/public/observation-photos/obs-123/0.jpg');
});

test('uploadPhoto throws when 400 upload error and file is not found on HEAD', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'some other error' }),
    })
    .mockResolvedValueOnce({ ok: false, status: 404 }); // HEAD — not found

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0))
    .rejects.toThrow('Upload failed: some other error');
});
