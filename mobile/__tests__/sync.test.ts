import { syncPending, syncHierarchy, _resetSyncLock } from '../lib/sync';
import { getPendingObservations, markSynced, cacheHierarchy } from '../lib/db';
import { uploadPhoto } from '../lib/storage';

jest.mock('../lib/db', () => ({
  getPendingObservations: jest.fn(),
  markSynced: jest.fn(),
  cacheHierarchy: jest.fn(),
}));

jest.mock('../lib/storage', () => ({
  uploadPhoto: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Fake observation builders
function fakeObs(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    text: 'Test observation',
    field_worker_name: 'Ravi Kumar',
    village_name: 'Rampur',
    block_lead_email: 'lead@example.com',
    submitted_at: '2026-05-03T10:00:00.000Z',
    photo_uris: [] as string[],
    ...overrides,
  };
}

function fakeRow(obs = fakeObs()) {
  return { id: obs.id as string, payload: JSON.stringify(obs) };
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetSyncLock();
  (global.fetch as jest.Mock) = jest.fn();
});

// ─── syncPending ────────────────────────────────────────────────────────────

test('syncPending returns zeros when queue is empty', async () => {
  (getPendingObservations as jest.Mock).mockReturnValue([]);
  const result = await syncPending();
  expect(result).toEqual({ synced: 0, failed: 0, errors: [] });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('syncPending POSTs a UUID observation id and marks it synced', async () => {
  const obs = fakeObs();
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  const result = await syncPending();

  const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
  const body = JSON.parse(opts.body);
  expect(url).toContain('/api/observations');
  expect(opts.method).toBe('POST');
  expect(UUID_RE.test(body.id)).toBe(true);
  expect(body).toMatchObject({
    text: 'Test observation',
    field_worker_name: 'Ravi Kumar',
    village_name: 'Rampur',
    photo_urls: [],
  });
  expect(body.photo_uris).toBeUndefined();
  expect(markSynced).toHaveBeenCalledWith(obs.id);
  expect(result).toEqual({ synced: 1, failed: 0, errors: [] });
});

test('syncPending stays in queue when server returns 500 (non-UUID id was the root cause)', async () => {
  // This was the real bug: mobile generated "1746283324-abc3f2" which Supabase
  // rejected with "invalid input syntax for type uuid", returning 500.
  const obs = fakeObs({ id: `${Date.now()}-badid` }); // old broken format
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  const result = await syncPending();

  expect(markSynced).not.toHaveBeenCalled();
  expect(result.failed).toBe(1);
});

test('syncPending discards observation and deletes photos on 400', async () => {
  const FileSystem = require('expo-file-system');
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/a.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock).mockResolvedValue('https://cdn.example.com/a.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 400,
    json: () => Promise.resolve({ error: 'missing field' }),
  });

  const result = await syncPending();

  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/obs_photos/a.jpg', { idempotent: true });
  expect(markSynced).toHaveBeenCalledWith(obs.id);
  expect(result).toMatchObject({ synced: 0, failed: 1 });
  expect(result.errors[0]).toContain('missing field');
});

test('syncPending stays in queue when network throws', async () => {
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

  const result = await syncPending();

  expect(markSynced).not.toHaveBeenCalled();
  expect(result.failed).toBe(1);
});

test('syncPending stays in queue when fetch times out', async () => {
  jest.useFakeTimers();
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockImplementation((_url: string, opts: RequestInit) =>
    new Promise((_res, rej) => {
      opts?.signal?.addEventListener('abort', () =>
        rej(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      );
    })
  );

  const p = syncPending();
  await jest.advanceTimersByTimeAsync(31_000);
  const result = await p;

  expect(markSynced).not.toHaveBeenCalled();
  expect(result.failed).toBe(1);
  jest.useRealTimers();
});

test('syncPending uploads photos then includes photo_urls and omits photo_uris in POST', async () => {
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/p0.jpg', 'file:///docs/obs_photos/p1.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock)
    .mockResolvedValueOnce('https://cdn.example.com/p0.jpg')
    .mockResolvedValueOnce('https://cdn.example.com/p1.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  expect(uploadPhoto).toHaveBeenCalledTimes(2);
  expect(uploadPhoto).toHaveBeenCalledWith('file:///docs/obs_photos/p0.jpg', obs.id, 0);
  expect(uploadPhoto).toHaveBeenCalledWith('file:///docs/obs_photos/p1.jpg', obs.id, 1);

  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.photo_urls).toEqual(['https://cdn.example.com/p0.jpg', 'https://cdn.example.com/p1.jpg']);
  expect(body.photo_uris).toBeUndefined();
});

test('syncPending deletes local photo files after successful sync', async () => {
  const FileSystem = require('expo-file-system');
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/x.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock).mockResolvedValue('https://cdn.example.com/x.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/obs_photos/x.jpg', { idempotent: true });
});

test('syncPending stays in queue when photo upload fails', async () => {
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/bad.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock).mockRejectedValue(new Error('Upload failed: 403'));

  const result = await syncPending();

  expect(global.fetch).not.toHaveBeenCalled();
  expect(markSynced).not.toHaveBeenCalled();
  expect(result.failed).toBe(1);
});

test('syncPending processes multiple observations independently', async () => {
  const obs1 = fakeObs({ id: '550e8400-e29b-41d4-a716-446655440001', text: 'First' });
  const obs2 = fakeObs({ id: '550e8400-e29b-41d4-a716-446655440002', text: 'Second' });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs1), fakeRow(obs2)]);
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: false, status: 500 });

  const result = await syncPending();

  expect(markSynced).toHaveBeenCalledWith(obs1.id);
  expect(markSynced).not.toHaveBeenCalledWith(obs2.id);
  expect(result).toEqual({ synced: 1, failed: 1, errors: [] });
});

test('syncPending does not run concurrently (lock)', async () => {
  let resolveFirst!: (r: Response) => void;
  const hanging = new Promise<Response>(res => { resolveFirst = res; });
  (global.fetch as jest.Mock).mockReturnValueOnce(hanging);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);

  const first = syncPending();
  const secondResult = await syncPending();

  expect(secondResult).toEqual({ synced: 0, failed: 0, errors: [] });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  resolveFirst({ ok: false, status: 500 } as Response);
  await first;
});

test('syncPending retries after lock clears when called while in-flight', async () => {
  const obs1 = fakeObs({ id: '550e8400-e29b-41d4-a716-446655440001' });
  const obs2 = fakeObs({ id: '550e8400-e29b-41d4-a716-446655440002' });
  let resolveFirst!: (r: Response) => void;
  const hanging = new Promise<Response>(res => { resolveFirst = res; });

  (global.fetch as jest.Mock)
    .mockReturnValueOnce(hanging)
    .mockResolvedValue({ ok: true });
  (getPendingObservations as jest.Mock)
    .mockReturnValueOnce([fakeRow(obs1)])
    .mockReturnValueOnce([fakeRow(obs2)]);

  const first = syncPending();
  syncPending(); // blocked — schedules retry

  resolveFirst({ ok: false, status: 500 } as Response);
  await first;
  await new Promise(r => setTimeout(r, 0)); // let retry run

  expect(markSynced).toHaveBeenCalledWith(obs2.id);
});

// ─── syncHierarchy ───────────────────────────────────────────────────────────

const FIELD_WORKERS = [
  { field_worker_name: 'Ravi Kumar' },
  { field_worker_name: 'Sunita Devi' },
];
const VILLAGES_RAVI = [{ village_name: 'Rampur' }, { village_name: 'Sitapur' }];
const VILLAGES_SUNITA = [{ village_name: 'Govindpur' }];

function mockHierarchyFetch() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('field-workers')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ field_workers: FIELD_WORKERS }) });
    }
    if (url.includes('Ravi+Kumar') || url.includes('Ravi%20Kumar')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ villages: VILLAGES_RAVI }) });
    }
    if (url.includes('Sunita+Devi') || url.includes('Sunita%20Devi')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ villages: VILLAGES_SUNITA }) });
    }
    return Promise.resolve({ ok: false });
  });
}

test('syncHierarchy fetches field workers + villages and caches all rows', async () => {
  mockHierarchyFetch();

  await syncHierarchy('lead@example.com');

  expect(cacheHierarchy).toHaveBeenCalledWith('lead@example.com', [
    { field_worker_name: 'Ravi Kumar', village_name: 'Rampur' },
    { field_worker_name: 'Ravi Kumar', village_name: 'Sitapur' },
    { field_worker_name: 'Sunita Devi', village_name: 'Govindpur' },
  ]);
});

test('syncHierarchy does nothing when field-workers fetch fails', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

  await syncHierarchy('lead@example.com');

  expect(cacheHierarchy).not.toHaveBeenCalled();
});

test('syncHierarchy skips a field worker when their village fetch fails', async () => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('field-workers')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ field_workers: FIELD_WORKERS }) });
    }
    if (url.includes('Ravi')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ villages: VILLAGES_RAVI }) });
    }
    return Promise.resolve({ ok: false }); // Sunita's villages fail
  });

  await syncHierarchy('lead@example.com');

  expect(cacheHierarchy).toHaveBeenCalledWith('lead@example.com', [
    { field_worker_name: 'Ravi Kumar', village_name: 'Rampur' },
    { field_worker_name: 'Ravi Kumar', village_name: 'Sitapur' },
  ]);
});

test('syncHierarchy leaves stale cache intact when network throws', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

  await expect(syncHierarchy('lead@example.com')).resolves.toBeUndefined();
  expect(cacheHierarchy).not.toHaveBeenCalled();
});

test('syncHierarchy times out gracefully and leaves stale cache intact', async () => {
  jest.useFakeTimers();
  (global.fetch as jest.Mock).mockImplementation((_url: string, opts: RequestInit) =>
    new Promise((_res, rej) => {
      opts?.signal?.addEventListener('abort', () =>
        rej(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      );
    })
  );

  const p = syncHierarchy('lead@example.com');
  await jest.advanceTimersByTimeAsync(31_000);
  await p;

  expect(cacheHierarchy).not.toHaveBeenCalled();
  jest.useRealTimers();
});
