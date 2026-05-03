import { initDB, queueObservation, getPendingObservations, markSynced, cacheHierarchy, getCachedFieldWorkers, getCachedVillages } from '../lib/db';

jest.mock('expo-sqlite');

const { _reset } = require('expo-sqlite');

beforeEach(() => {
  _reset();
  initDB();
});

test('queueObservation stores a pending observation', () => {
  queueObservation({ id: 'abc-123', text: 'test obs', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', submitted_at: '2024-01-01T00:00:00Z' });
  const pending = getPendingObservations();
  expect(pending).toHaveLength(1);
  expect(pending[0].id).toBe('abc-123');
});

test('markSynced removes observation from the pending list', () => {
  queueObservation({ id: 'xyz-456', text: 'test obs', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', submitted_at: '2024-01-01T00:00:00Z' });
  markSynced('xyz-456');
  expect(getPendingObservations()).toHaveLength(0);
});

// Issue A: queue write guard
test('queueObservation propagates storage errors', () => {
  const sqlite = require('expo-sqlite');
  sqlite._db.runSync.mockImplementationOnce(() => { throw new Error('disk full'); });
  expect(() => queueObservation({ id: 'e', text: 't', field_worker_name: 'W', village_name: 'V', block_lead_email: 'e@e.com', submitted_at: '2024-01-01T00:00:00Z' }))
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

test('cacheHierarchy does not affect entries for other block leads', () => {
  cacheHierarchy('a@test.com', [{ field_worker_name: 'Worker A', village_name: 'Village A' }]);
  cacheHierarchy('b@test.com', [{ field_worker_name: 'Worker B', village_name: 'Village B' }]);
  cacheHierarchy('a@test.com', [{ field_worker_name: 'Worker A2', village_name: 'Village A2' }]);

  expect(getCachedFieldWorkers('a@test.com')).toEqual(['Worker A2']);
  expect(getCachedFieldWorkers('b@test.com')).toEqual(['Worker B']);
});
