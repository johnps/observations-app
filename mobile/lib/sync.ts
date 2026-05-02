import { getPendingObservations, markSynced } from './db';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function syncPending() {
  const pending = getPendingObservations();
  for (const row of pending) {
    try {
      const res = await fetch(`${API_BASE}/api/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: row.payload,
      });
      if (res.ok) markSynced(row.id);
    } catch {
      // network error — leave in queue for next sync attempt
    }
  }
}
