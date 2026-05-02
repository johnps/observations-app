import { uploadPhoto } from '../lib/storage';

beforeEach(() => {
  (global.fetch as jest.Mock) = jest.fn();
});

test('uploadPhoto POSTs to Supabase Storage with auth header and returns public URL', async () => {
  // fetch called twice: once to read the local file, once to upload
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })) })
    .mockResolvedValueOnce({ ok: true });

  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
  expect(uploadCall[0]).toContain('/storage/v1/object/observation-photos/obs-123/0.jpg');
  expect(uploadCall[1].headers['Authorization']).toMatch(/^Bearer /);
  expect(url).toContain('obs-123/0.jpg');
});

test('uploadPhoto throws when upload response is not ok', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob()) })
    .mockResolvedValueOnce({ ok: false, status: 403 });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).rejects.toThrow('Upload failed');
});
