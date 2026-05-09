import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'observation-photos';
const UPLOAD_TIMEOUT_MS = 60_000;
const TOKEN_EXPIRY_BUFFER_S = 60;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Returns a fresh access token, proactively refreshing when within TOKEN_EXPIRY_BUFFER_S of expiry.
// Throws 'Upload failed: no authenticated session' for all auth failure modes (null session,
// refresh_token_already_used, or any refresh error) so callers can detect auth failures by message.
async function getFreshAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Upload failed: no authenticated session');

  if (session.expires_at !== undefined) {
    const secsUntilExpiry = session.expires_at - Math.floor(Date.now() / 1000);
    if (secsUntilExpiry < TOKEN_EXPIRY_BUFFER_S) {
      console.log(`[storage] refreshing token — expires in ${secsUntilExpiry}s`);
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
      if (error || !refreshed) {
        console.log('[storage] refresh failed —', error?.message);
        throw new Error('Upload failed: no authenticated session');
      }
      return refreshed.access_token;
    }
  }

  return session.access_token;
}

export async function uploadPhoto(uri: string, obsId: string, index: number): Promise<string> {
  const path = `${obsId}/${index}.jpg`;

  const authToken = await getFreshAccessToken();

  // fetch('file://...') produces a native React Native blob — the only body type
  // React Native's networking stack can upload. ArrayBuffer/Uint8Array are not supported.
  const fileRes = await fetchWithTimeout(uri, {});
  const blob = await fileRes.blob();

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

    // Upsert fails with an RLS error when the UPDATE policy is missing but the file already
    // exists. HEAD-check: if the file is there, this upload step is already done.
    if (uploadRes.status === 400 || uploadRes.status === 409) {
      const headRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
        { method: 'HEAD', headers: { Authorization: `Bearer ${authToken}`, apikey: SUPABASE_ANON_KEY } }
      );
      if (headRes.ok) {
        console.log('[storage] file already exists, treating as uploaded', path);
        return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      }
    }

    console.log('[storage] upload error', msg);
    throw new Error(`Upload failed: ${msg}`);
  }

  console.log('[storage] uploaded ok', path);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
