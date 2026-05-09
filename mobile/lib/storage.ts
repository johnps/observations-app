import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'observation-photos';
const UPLOAD_TIMEOUT_MS = 60_000;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export async function uploadPhoto(uri: string, obsId: string, index: number): Promise<string> {
  const path = `${obsId}/${index}.jpg`;

  // Use the authenticated user's JWT so the storage RLS policy (authenticated role) passes.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Upload failed: no authenticated session');

  // fetch('file://...') produces a native React Native blob — the only body type
  // React Native's networking stack can upload. ArrayBuffer/Uint8Array are not supported.
  const fileRes = await fetchWithTimeout(uri, {});
  const blob = await fileRes.blob();

  const authToken = session.access_token;

  const uploadRes = await fetchWithTimeout(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
    }
  );

  if (!uploadRes.ok) {
    const body = await uploadRes.json().catch(() => ({}));
    const msg = body.message ?? body.error ?? String(uploadRes.status);
    console.log('[storage] upload error', msg);
    throw new Error(`Upload failed: ${msg}`);
  }

  console.log('[storage] uploaded ok', path);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
