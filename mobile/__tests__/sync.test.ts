import type { SyncResult } from '../lib/sync';
import type { PendingObservation } from '../types/observation';

jest.mock('../lib/db', () => ({
  getPendingObservations: jest.fn(),
  markSynced: jest.fn(),
  markFailed: jest.fn(),
  cacheHierarchy: jest.fn(),
  incrementRetryCount: jest.fn().mockReturnValue(1),
  MAX_RETRIES: 5,
}));

jest.mock('../lib/storage', () => ({
  uploadPhoto: jest.fn(),
}));

const mockFileDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockFileDelete })),
}));

// Capture the listener so tests can simulate connectivity changes.
let _netInfoCallback: ((state: { isConnected: boolean | null }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    addEventListener: jest.fn().mockImplementation((cb: any) => {
      _netInfoCallback = cb;
      return () => {};
    }),
  },
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let syncPending: () => Promise<SyncResult>;
let syncHierarchy: (email: string) => Promise<void>;
let getPendingObservations: jest.Mock;
let markSynced: jest.Mock;
let markFailed: jest.Mock;
let cacheHierarchy: jest.Mock;
let incrementRetryCount: jest.Mock;
let uploadPhoto: jest.Mock;

function fakeObs(overrides: Partial<PendingObservation> = {}): PendingObservation {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    text: 'Test observation',
    field_worker_name: 'Ravi Kumar',
    village_name: 'Rampur',
    block_lead_email: 'lead@example.com',
    submitted_at: '2026-05-03T10:00:00.000Z',
    photo_uris: [],
    ...overrides,
  };
}

function fakeRow(obs = fakeObs()) {
  return obs;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  const db = require('../lib/db');
  getPendingObservations = db.getPendingObservations;
  markSynced = db.markSynced;
  markFailed = db.markFailed;
  cacheHierarchy = db.cacheHierarchy;
  incrementRetryCount = db.incrementRetryCount;

  const storage = require('../lib/storage');
  uploadPhoto = storage.uploadPhoto;

  const sync = require('../lib/sync');
  syncPending = sync.syncPending;
  syncHierarchy = sync.syncHierarchy;

  (global.fetch as jest.Mock) = jest.fn();
});

// ─── syncPending ────────────────────────────────────────────────────────────

test('syncPending returns zeros when queue is empty', async () => {
  (getPendingObservations as jest.Mock).mockReturnValue([]);
  const result = await syncPending();
  expect(result).toEqual({ synced: 0, failed: 0, errors: [] });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('syncPending returns skipped: true when offline', async () => {
  _netInfoCallback?.({ isConnected: false });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);

  const result = await syncPending();

  expect(result).toEqual({ skipped: true, synced: 0, failed: 0, errors: [] });
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

test('syncPending moves observation to failed list and deletes photos on 400', async () => {
  const { File } = require('expo-file-system');
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/a.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock).mockResolvedValue('https://cdn.example.com/a.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 400,
    json: () => Promise.resolve({ error: 'missing field' }),
  });

  const result = await syncPending();

  expect(File).toHaveBeenCalledWith('file:///docs/obs_photos/a.jpg');
  expect(mockFileDelete).toHaveBeenCalled();
  expect(markSynced).not.toHaveBeenCalled();
  expect(markFailed).toHaveBeenCalledWith(obs, 'missing field');
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
  const { File } = require('expo-file-system');
  const obs = fakeObs({ photo_uris: ['file:///docs/obs_photos/x.jpg'] });
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (uploadPhoto as jest.Mock).mockResolvedValue('https://cdn.example.com/x.jpg');
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  await syncPending();

  expect(File).toHaveBeenCalledWith('file:///docs/obs_photos/x.jpg');
  expect(mockFileDelete).toHaveBeenCalled();
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

test('syncPending returns skipped: true when a sync is already running', async () => {
  let resolveFirst!: (r: Response) => void;
  const hanging = new Promise<Response>(res => { resolveFirst = res; });
  (global.fetch as jest.Mock).mockReturnValueOnce(hanging);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);

  const first = syncPending();
  const secondResult = await syncPending();

  expect(secondResult.skipped).toBe(true);
  expect(secondResult).toMatchObject({ synced: 0, failed: 0, errors: [] });

  resolveFirst({ ok: false, status: 500 } as Response);
  await first;
});

test('syncPending does not run concurrently (lock)', async () => {
  let resolveFirst!: (r: Response) => void;
  const hanging = new Promise<Response>(res => { resolveFirst = res; });
  (global.fetch as jest.Mock).mockReturnValueOnce(hanging);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);

  const first = syncPending();
  const secondResult = await syncPending();

  expect(secondResult.skipped).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);

  resolveFirst({ ok: false, status: 500 } as Response);
  await first;
});

test('syncPending deferred retry is blocked by backoff when first cycle failed', async () => {
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
  syncPending(); // blocked — schedules deferred retry

  resolveFirst({ ok: false, status: 500 } as Response); // first cycle fails → sets backoff
  await first;
  await new Promise(r => setTimeout(r, 0)); // deferred retry fires but is blocked by backoff

  // obs2 is not synced — backoff prevents the immediate deferred retry
  expect(markSynced).not.toHaveBeenCalledWith(obs2.id);
});

test('syncPending skips when called within backoff window after a failed cycle', async () => {
  const now = 1_000_000;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  await syncPending(); // fails → sets backoff to 30s

  // still within the 30s backoff window
  jest.spyOn(Date, 'now').mockReturnValue(now + 29_000);
  const result = await syncPending();

  expect(result.skipped).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1); // not called again
  jest.restoreAllMocks();
});

test('syncPending proceeds after backoff window has elapsed', async () => {
  const now = 1_000_000;
  jest.spyOn(Date, 'now').mockReturnValue(now);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  await syncPending(); // fails → sets backoff to 30s

  jest.spyOn(Date, 'now').mockReturnValue(now + 31_000); // beyond the window
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

  const result = await syncPending();

  expect(result.skipped).toBeUndefined();
  expect(result.synced).toBe(1);
  jest.restoreAllMocks();
});

test('syncPending doubles backoff with each failed cycle', async () => {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  await syncPending(); // backoff = 30s, window ends at now+30s
  now += 31_000;      // advance past 30s
  await syncPending(); // second failure → backoff = 60s, window ends at now+60s

  now += 59_000;       // within 60s window
  const result = await syncPending();
  expect(result.skipped).toBe(true);
  jest.restoreAllMocks();
});

test('syncPending caps backoff at 900s regardless of failure count', async () => {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  // burn through: 30s → 60s → 120s → 240s → 480s → 900s (capped)
  for (let i = 0; i < 6; i++) {
    const prev = now;
    now += 901_000; // jump well past whatever the current backoff is
    await syncPending();
    now = prev + 901_000; // keep advancing
  }

  // after cap: window should be at most 900s ahead of last failure
  const lastFailureTime = now;
  const result = await syncPending(); // within 900s window — still blocked
  expect(result.skipped).toBe(true);

  now = lastFailureTime + 901_000; // past 900s
  const result2 = await syncPending();
  expect(result2.skipped).toBeUndefined();
  jest.restoreAllMocks();
});

test('syncPending resets backoff to zero after a fully successful cycle', async () => {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  await syncPending(); // backoff = 30s

  now += 31_000; // advance past backoff
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow()]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true }); // success

  await syncPending(); // succeeds → resets backoff

  // immediately after success: no backoff window
  const result = await syncPending();
  expect(result.skipped).toBeUndefined();
  jest.restoreAllMocks();
});

test('syncPending increments retry_count on transient failure', async () => {
  const obs = fakeObs();
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

  await syncPending();

  expect(incrementRetryCount).toHaveBeenCalledWith(obs.id);
  expect(markSynced).not.toHaveBeenCalled();
});

test('syncPending moves observation to failed list when retry cap is reached', async () => {
  const obs = fakeObs();
  (getPendingObservations as jest.Mock).mockReturnValue([fakeRow(obs)]);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
  incrementRetryCount.mockReturnValue(5); // cap reached on this increment

  const result = await syncPending();

  expect(markSynced).not.toHaveBeenCalled();
  expect(markFailed).toHaveBeenCalledWith(obs, 'max retries exceeded');
  expect(result.errors[0]).toContain(obs.id);
  expect(result.failed).toBe(1);
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
