const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'observation-photos';

export async function uploadPhoto(uri: string, obsId: string, index: number): Promise<string> {
  const path = `${obsId}/${index}.jpg`;
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();

  const uploadRes = await fetch(
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
