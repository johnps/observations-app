import * as FileSystem from 'expo-file-system';
import { getPendingObservations, markSynced } from './db';
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
