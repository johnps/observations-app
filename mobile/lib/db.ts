import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export function initDB() {
  db = SQLite.openDatabaseSync('observations.db');
  db.execSync(
    `CREATE TABLE IF NOT EXISTS pending_observations (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    )`
  );
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
