import { initDB, queueObservation, getPendingObservations, markSynced } from '../lib/db';

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
