import { uploadPhoto } from '../lib/storage';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-jwt' } },
      }),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
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

test('uploadPhoto throws with server error message when upload is not ok', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'new row violates row-level security policy' }),
    });

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

test('uploadPhoto falls back to anon key when no session', async () => {
  const { supabase } = require('../lib/supabase');
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: true });

  await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  const [, opts] = (global.fetch as jest.Mock).mock.calls[1];
  expect(opts.headers['Authorization']).toMatch(/^Bearer /);
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
