import { uploadPhoto } from '../lib/storage';

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();

  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: 'https://supabase.co/storage/v1/object/public/observation-photos/obs-123/0.jpg' },
  });
});

test('uploadPhoto reads local file, uploads via Supabase client, and returns public URL', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
  });

  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(mockUpload).toHaveBeenCalledWith(
    'obs-123/0.jpg',
    expect.any(Blob),
    { contentType: 'image/jpeg', upsert: true },
  );
  expect(url).toContain('obs-123/0.jpg');
});

test('uploadPhoto throws when Supabase upload returns an error', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob()),
  });
  mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).rejects.toThrow('Upload failed');
});

test('uploadPhoto upserts — does not fail when file already exists', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob(['img'])),
  });
  // upsert: true means Supabase replaces existing files without error
  mockUpload.mockResolvedValue({ error: null });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).resolves.toBeDefined();
  expect(mockUpload).toHaveBeenCalledWith(expect.any(String), expect.any(Blob), expect.objectContaining({ upsert: true }));
});

test('uploadPhoto throws when local file read times out', async () => {
  jest.useFakeTimers();
  (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // never resolves

  const promise = uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);
  const assertion = expect(promise).rejects.toThrow('Read timeout');
  await jest.advanceTimersByTimeAsync(61_000);
  await assertion;
  jest.useRealTimers();
});
