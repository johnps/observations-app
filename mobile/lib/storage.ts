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
  const fileRes = await fetchWithTimeout(uri, {});
  const blob = await fileRes.blob();

  const uploadRes = await fetchWithTimeout(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
      },
      body: blob,
    }
  );

  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
