import { uploadPhoto } from '../lib/storage';

const mockBytes = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ bytes: mockBytes })),
}));

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
  mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: 'https://supabase.co/storage/v1/object/public/observation-photos/obs-123/0.jpg' },
  });
});

test('uploadPhoto reads local file via File.bytes(), uploads via Supabase client, returns public URL', async () => {
  const url = await uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0);

  expect(mockBytes).toHaveBeenCalled();
  expect(mockUpload).toHaveBeenCalledWith(
    'obs-123/0.jpg',
    expect.any(Blob),
    { contentType: 'image/jpeg', upsert: true },
  );
  expect(url).toContain('obs-123/0.jpg');
});

test('uploadPhoto throws when Supabase upload returns an error', async () => {
  mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).rejects.toThrow('Upload failed');
});

test('uploadPhoto upserts — does not fail when file already exists', async () => {
  mockUpload.mockResolvedValue({ error: null });

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).resolves.toBeDefined();
  expect(mockUpload).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Blob),
    expect.objectContaining({ upsert: true }),
  );
});

test('uploadPhoto throws when File.bytes() fails', async () => {
  mockBytes.mockRejectedValue(new Error('File not found'));

  await expect(uploadPhoto('file:///tmp/photo.jpg', 'obs-123', 0)).rejects.toThrow('File not found');
});
