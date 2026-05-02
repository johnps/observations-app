import { syncPending } from '../lib/sync';
import { getPendingObservations, markSynced } from '../lib/db';

jest.mock('../lib/db', () => ({
  getPendingObservations: jest.fn(),
  markSynced: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

test('syncPending posts each pending observation and marks it synced', async () => {
  const row = { id: 'abc', payload: '{"id":"abc","text":"test"}' };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/observations'),
    expect.objectContaining({ method: 'POST', body: row.payload })
  );
  expect(markSynced).toHaveBeenCalledWith('abc');
});

test('syncPending leaves observation in queue when fetch throws', async () => {
  const row = { id: 'def', payload: '{"id":"def","text":"test"}' };
  (getPendingObservations as jest.Mock).mockReturnValue([row]);
  (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

  await syncPending();

  expect(markSynced).not.toHaveBeenCalled();
});
