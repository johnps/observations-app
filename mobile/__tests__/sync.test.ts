import { syncPending } from '../lib/sync';
import { getPendingObservations, markSynced } from '../lib/db';
import { uploadPhoto } from '../lib/storage';

jest.mock('../lib/db', () => ({
  getPendingObservations: jest.fn(),
  markSynced: jest.fn(),
}));

jest.mock('../lib/storage', () => ({
  uploadPhoto: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

test('syncPending posts pending observations and marks them synced', async () => {
  const row = { id: 'abc', payload: '{"id":"abc","text":"test"}' };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  const postedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/observations'),
    expect.objectContaining({ method: 'POST' })
  );
  expect(postedBody).toMatchObject({ id: 'abc', text: 'test', photo_urls: [] });
  expect(markSynced).toHaveBeenCalledWith('abc');
});

test('syncPending leaves observation in queue when fetch throws', async () => {
  const row = { id: 'def', payload: '{"id":"def","text":"test"}' };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

  await syncPending();

  expect(markSynced).not.toHaveBeenCalled();
});

test('syncPending uploads photos before posting and includes photo_urls in payload', async () => {
  const row = {
    id: 'ghi',
    payload: JSON.stringify({ id: 'ghi', text: 'test', photo_uris: ['file:///a.jpg', 'file:///b.jpg'] }),
  };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (uploadPhoto as jest.Mock)
    .mockResolvedValueOnce('https://storage.example.com/a.jpg')
    .mockResolvedValueOnce('https://storage.example.com/b.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  const postedBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(postedBody.photo_urls).toEqual(['https://storage.example.com/a.jpg', 'https://storage.example.com/b.jpg']);
  expect(postedBody.photo_uris).toBeUndefined();
  expect(markSynced).toHaveBeenCalledWith('ghi');
});

test('syncPending deletes local files after successful upload', async () => {
  const FileSystem = require('expo-file-system');
  const row = {
    id: 'jkl',
    payload: JSON.stringify({ id: 'jkl', text: 'test', photo_uris: ['file:///c.jpg'] }),
  };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (uploadPhoto as jest.Mock).mockResolvedValue('https://storage.example.com/c.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///c.jpg', { idempotent: true });
});
