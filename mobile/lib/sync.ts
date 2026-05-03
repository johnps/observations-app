import * as FileSystem from 'expo-file-system';
import { getPendingObservations, markSynced, cacheHierarchy } from './db';
import { uploadPhoto } from './storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function syncPending() {
  const pending = getPendingObservations();
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

      const res = await fetch(`${API_BASE}/api/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (res.ok) {
        for (const uri of photoUris) {
          try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
        }
        markSynced(row.id);
      }
    } catch {
      // network or upload error — leave in queue for next sync attempt
    }
  }
}

export async function syncHierarchy(blockLeadEmail: string) {
  try {
    const res = await fetch(`${API_BASE}/api/hierarchy/field-workers?block_lead_email=${encodeURIComponent(blockLeadEmail)}`);
    if (!res.ok) return;
    const { field_workers } = await res.json();
    const rows: { field_worker_name: string; village_name: string }[] = [];
    for (const fw of field_workers ?? []) {
      const vRes = await fetch(`${API_BASE}/api/hierarchy/villages?block_lead_email=${encodeURIComponent(blockLeadEmail)}&field_worker_name=${encodeURIComponent(fw.field_worker_name)}`);
      if (!vRes.ok) continue;
      const { villages } = await vRes.json();
      for (const v of villages ?? []) {
        rows.push({ field_worker_name: fw.field_worker_name, village_name: v.village_name });
      }
    }
    cacheHierarchy(blockLeadEmail, rows);
  } catch { /* leave stale cache */ }
}
