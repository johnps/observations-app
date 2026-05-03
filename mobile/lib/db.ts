import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export function initDB() {
  db = SQLite.openDatabaseSync('observations.db');
  db.execSync(`CREATE TABLE IF NOT EXISTS pending_observations (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0
  )`);
  db.execSync(`CREATE TABLE IF NOT EXISTS hierarchy_cache (
    block_lead_email TEXT NOT NULL,
    field_worker_name TEXT NOT NULL,
    village_name TEXT NOT NULL
  )`);
}

export interface PendingRow {
  id: string;
  payload: string;
}

export function queueObservation(obs: Record<string, unknown>) {
  db.runSync(
    'INSERT OR REPLACE INTO pending_observations (id, payload, synced) VALUES (?, ?, 0)',
    [obs.id as string, JSON.stringify(obs)]
  );
}

export function getPendingObservations(): PendingRow[] {
  return db.getAllSync<PendingRow>(
    'SELECT id, payload FROM pending_observations WHERE synced = 0'
  );
}

export function markSynced(id: string) {
  db.runSync(
    'UPDATE pending_observations SET synced = 1 WHERE id = ?',
    [id]
  );
}

export function cacheHierarchy(blockLeadEmail: string, rows: { field_worker_name: string; village_name: string }[]) {
  db.runSync('DELETE FROM hierarchy_cache WHERE block_lead_email = ?', [blockLeadEmail]);
  for (const r of rows) {
    db.runSync(
      'INSERT INTO hierarchy_cache (block_lead_email, field_worker_name, village_name) VALUES (?, ?, ?)',
      [blockLeadEmail, r.field_worker_name, r.village_name]
    );
  }
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
