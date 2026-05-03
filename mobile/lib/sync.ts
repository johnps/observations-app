import * as FileSystem from 'expo-file-system';
import { getPendingObservations, markSynced, cacheHierarchy } from './db';
import { uploadPhoto } from './storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const FETCH_TIMEOUT_MS = 30_000;

let _syncing = false;
export function _resetSyncLock() { _syncing = false; }

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export type SyncResult = { synced: number; failed: number; errors: string[] };

export async function syncPending(): Promise<SyncResult> {
  if (_syncing) return { synced: 0, failed: 0, errors: [] };
  _syncing = true;

  const pending = getPendingObservations();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    for (const row of pending) {
      try {
        const obs = JSON.parse(row.payload) as Record<string, unknown>;
        const photoUris = (obs.photo_uris as string[] | undefined) ?? [];

        const photoUrls: string[] = [];
        for (let i = 0; i < photoUris.length; i++) {
          photoUrls.push(await uploadPhoto(photoUris[i], obs.id as string, i));
        }

        const { photo_uris: _, ...rest } = obs;
        const payload = JSON.stringify({ ...rest, photo_urls: photoUrls });

        const res = await fetchWithTimeout(`${API_BASE}/api/observations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });

        if (res.ok) {
          for (const uri of photoUris) {
            try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
          }
          markSynced(row.id);
          synced++;
        } else if (res.status === 400) {
          for (const uri of photoUris) {
            try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
          }
          const body = await res.json().catch(() => ({}));
          errors.push(`Discarded observation ${row.id}: ${body.error ?? 'invalid data'}`);
          markSynced(row.id);
          failed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } finally {
    _syncing = false;
  }

  return { synced, failed, errors };
}

export async function syncHierarchy(blockLeadEmail: string) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/hierarchy/field-workers?block_lead_email=${encodeURIComponent(blockLeadEmail)}`,
      {}
    );
    if (!res.ok) return;
    const { field_workers } = await res.json();
    const rows: { field_worker_name: string; village_name: string }[] = [];
    for (const fw of field_workers ?? []) {
      const vRes = await fetchWithTimeout(
        `${API_BASE}/api/hierarchy/villages?block_lead_email=${encodeURIComponent(blockLeadEmail)}&field_worker_name=${encodeURIComponent(fw.field_worker_name)}`,
        {}
      );
      if (!vRes.ok) continue;
      const { villages } = await vRes.json();
      for (const v of villages ?? []) {
        rows.push({ field_worker_name: fw.field_worker_name, village_name: v.village_name });
      }
    }
    cacheHierarchy(blockLeadEmail, rows);
  } catch { /* leave stale cache */ }
}
