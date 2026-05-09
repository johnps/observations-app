import { initDB, queueObservation, getPendingObservations, markSynced, markFailed, getFailedObservations, clearFailed, requeueFailed, cacheHierarchy, getCachedFieldWorkers, getCachedVillages, incrementRetryCount, MAX_RETRIES } from '../lib/db';
import type { PendingObservation } from '../types/observation';

jest.mock('expo-sqlite');

const { _reset } = require('expo-sqlite');

beforeEach(() => {
  _reset();
  initDB();
});

test('queueObservation stores a pending observation', () => {
  queueObservation({ id: 'abc-123', text: 'test obs', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' });
  const pending = getPendingObservations();
  expect(pending).toHaveLength(1);
  expect(pending[0].id).toBe('abc-123');
});

test('markSynced removes observation from the pending list', () => {
  queueObservation({ id: 'xyz-456', text: 'test obs', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' });
  markSynced('xyz-456');
  expect(getPendingObservations()).toHaveLength(0);
});

// Issue A: queue write guard
test('queueObservation propagates storage errors', () => {
  const sqlite = require('expo-sqlite');
  sqlite._db.runSync.mockImplementationOnce(() => { throw new Error('disk full'); });
  expect(() => queueObservation({ id: 'e', text: 't', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' }))
    .toThrow('disk full');
});

// Issue B: atomic hierarchy cache
test('cacheHierarchy replaces all previous entries for a block lead', () => {
  cacheHierarchy('lead@test.com', [
    { field_worker_name: 'Old Worker', village_name: 'Old Village' },
  ]);
  expect(getCachedFieldWorkers('lead@test.com')).toEqual(['Old Worker']);

  cacheHierarchy('lead@test.com', [
    { field_worker_name: 'New Worker', village_name: 'New Village' },
  ]);
  expect(getCachedFieldWorkers('lead@test.com')).toEqual(['New Worker']);
  expect(getCachedVillages('lead@test.com', 'Old Worker')).toEqual([]);
});

test('getPendingObservations returns typed observation fields — not a raw payload string', () => {
  queueObservation({
    id: 'abc-typed',
    text: 'typed test',
    field_worker_name: 'W',
    village_name: 'V',
    block_lead_email: 'e@e.com',
    photo_uris: ['file:///a.jpg'],
    submitted_at: '2024-01-01T00:00:00Z',
  });
  const pending = getPendingObservations();
  expect(pending[0].photo_uris).toEqual(['file:///a.jpg']);
  expect((pending[0] as any).payload).toBeUndefined();
});

test('cacheHierarchy does not affect entries for other block leads', () => {
  cacheHierarchy('a@test.com', [{ field_worker_name: 'Worker A', village_name: 'Village A' }]);
  cacheHierarchy('b@test.com', [{ field_worker_name: 'Worker B', village_name: 'Village B' }]);
  cacheHierarchy('a@test.com', [{ field_worker_name: 'Worker A2', village_name: 'Village A2' }]);

  expect(getCachedFieldWorkers('a@test.com')).toEqual(['Worker A2']);
  expect(getCachedFieldWorkers('b@test.com')).toEqual(['Worker B']);
});

test('incrementRetryCount increments and returns the new count', () => {
  queueObservation({ id: 'retry-1', text: 't', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' });
  expect(incrementRetryCount('retry-1')).toBe(1);
  expect(incrementRetryCount('retry-1')).toBe(2);
});

test('getPendingObservations excludes observations that have reached MAX_RETRIES', () => {
  queueObservation({ id: 'good', text: 't', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' });
  queueObservation({ id: 'exhausted', text: 't', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', photo_uris: [], submitted_at: '2024-01-01T00:00:00Z' });

  for (let i = 0; i < MAX_RETRIES; i++) incrementRetryCount('exhausted');

  const pending = getPendingObservations();
  expect(pending.map(o => o.id)).toEqual(['good']);
});

const fakeObs = (id: string): PendingObservation => ({
  id,
  text: 'test obs',
  field_worker_name: 'W',
  village_name: 'V',
  block_lead_email: 'e@e.com',
  photo_uris: [],
  submitted_at: '2024-01-01T00:00:00Z',
});

test('markFailed removes observation from pending queue', () => {
  const obs = fakeObs('fail-2');
  queueObservation(obs);
  expect(getPendingObservations()).toHaveLength(1);
  markFailed(obs, 'invalid data');
  expect(getPendingObservations()).toHaveLength(0);
});

test('markFailed stores observation in failed list', () => {
  const obs = fakeObs('fail-1');
  queueObservation(obs);
  markFailed(obs, 'max retries exceeded');
  const failed = getFailedObservations();
  expect(failed).toHaveLength(1);
  expect(failed[0].id).toBe('fail-1');
  expect(failed[0].reason).toBe('max retries exceeded');
  expect(JSON.parse(failed[0].payload).text).toBe('test obs');
});

test('requeueFailed moves observation back to pending queue with reset retry count', () => {
  const obs = fakeObs('requeue-1');
  queueObservation(obs);
  // burn some retries then mark failed
  incrementRetryCount('requeue-1');
  incrementRetryCount('requeue-1');
  markFailed(obs, 'max retries exceeded');
  expect(getPendingObservations()).toHaveLength(0);

  requeueFailed('requeue-1');

  const pending = getPendingObservations();
  expect(pending).toHaveLength(1);
  expect(pending[0].id).toBe('requeue-1');
});

test('requeueFailed removes observation from failed list', () => {
  const obs = fakeObs('requeue-2');
  queueObservation(obs);
  markFailed(obs, 'max retries exceeded');
  expect(getFailedObservations()).toHaveLength(1);

  requeueFailed('requeue-2');

  expect(getFailedObservations()).toHaveLength(0);
});

test('clearFailed removes observation from failed list', () => {
  const obs = fakeObs('fail-clear');
  queueObservation(obs);
  markFailed(obs, 'invalid data');
  expect(getFailedObservations()).toHaveLength(1);
  clearFailed('fail-clear');
  expect(getFailedObservations()).toHaveLength(0);
});
