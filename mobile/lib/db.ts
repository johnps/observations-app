import * as SQLite from 'expo-sqlite';
import type { PendingObservation, FailedObservation } from '../types/observation';

let db: SQLite.SQLiteDatabase;

export const MAX_RETRIES = 5;

export function initDB() {
  db = SQLite.openDatabaseSync('observations.db');
  db.execSync(`CREATE TABLE IF NOT EXISTS pending_observations (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0
  )`);
  try {
    db.execSync('ALTER TABLE pending_observations ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0');
  } catch {}
  db.execSync(`CREATE TABLE IF NOT EXISTS failed_observations (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, reason TEXT NOT NULL, failed_at TEXT NOT NULL
  )`);
  db.execSync(`CREATE TABLE IF NOT EXISTS hierarchy_cache (
    block_lead_email TEXT NOT NULL,
    field_worker_name TEXT NOT NULL,
    village_name TEXT NOT NULL
  )`);
}

interface PendingRow {
  id: string;
  payload: string;
}

export function queueObservation(obs: PendingObservation) {
  db.runSync(
    'INSERT OR REPLACE INTO pending_observations (id, payload, synced) VALUES (?, ?, 0)',
    [obs.id, JSON.stringify(obs)]
  );
}

export function getPendingObservations(): PendingObservation[] {
  const rows = db.getAllSync<PendingRow>(
    `SELECT id, payload FROM pending_observations WHERE synced = 0 AND retry_count < ${MAX_RETRIES}`
  );
  return rows.map(r => JSON.parse(r.payload) as PendingObservation);
}

export function markSynced(id: string) {
  db.runSync(
    'UPDATE pending_observations SET synced = 1 WHERE id = ?',
    [id]
  );
}

export function incrementRetryCount(id: string): number {
  db.runSync(
    'UPDATE pending_observations SET retry_count = retry_count + 1 WHERE id = ?',
    [id]
  );
  const rows = db.getAllSync<{ retry_count: number }>(
    'SELECT retry_count FROM pending_observations WHERE id = ?',
    [id]
  );
  return rows[0]?.retry_count ?? 1;
}

export function markFailed(obs: PendingObservation, reason: string) {
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT OR REPLACE INTO failed_observations (id, payload, reason, failed_at) VALUES (?, ?, ?, ?)',
      [obs.id, JSON.stringify(obs), reason, new Date().toISOString()]
    );
    db.runSync('UPDATE pending_observations SET synced = 1 WHERE id = ?', [obs.id]);
  });
}

export function getFailedObservations(): FailedObservation[] {
  return db.getAllSync<FailedObservation>(
    'SELECT id, payload, reason, failed_at FROM failed_observations'
  );
}

export function clearFailed(id: string) {
  db.runSync('DELETE FROM failed_observations WHERE id = ?', [id]);
}

export function requeueFailed(id: string) {
  db.withTransactionSync(() => {
    const rows = db.getAllSync<{ payload: string }>(
      'SELECT payload FROM failed_observations WHERE id = ?',
      [id]
    );
    if (!rows[0]) return;
    queueObservation(JSON.parse(rows[0].payload) as PendingObservation);
    clearFailed(id);
  });
}

export function cacheHierarchy(blockLeadEmail: string, rows: { field_worker_name: string; village_name: string }[]) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM hierarchy_cache WHERE block_lead_email = ?', [blockLeadEmail]);
    for (const r of rows) {
      db.runSync(
        'INSERT INTO hierarchy_cache (block_lead_email, field_worker_name, village_name) VALUES (?, ?, ?)',
        [blockLeadEmail, r.field_worker_name, r.village_name]
      );
    }
  });
}

export function getCachedFieldWorkers(blockLeadEmail: string): string[] {
  const rows = db.getAllSync<{ field_worker_name: string }>(
    'SELECT DISTINCT field_worker_name FROM hierarchy_cache WHERE block_lead_email = ? ORDER BY field_worker_name',
    [blockLeadEmail]
  );
  return rows.map(r => r.field_worker_name);
}

export function getCachedVillages(blockLeadEmail: string, fieldWorkerName: string): string[] {
  const rows = db.getAllSync<{ village_name: string }>(
    'SELECT village_name FROM hierarchy_cache WHERE block_lead_email = ? AND field_worker_name = ? ORDER BY village_name',
    [blockLeadEmail, fieldWorkerName]
  );
  return rows.map(r => r.village_name);
}
