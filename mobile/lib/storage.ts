import { supabase } from './supabase';

const BUCKET = 'observation-photos';
const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadPhoto(uri: string, obsId: string, index: number): Promise<string> {
  const path = `${obsId}/${index}.jpg`;

  const fileRes = await Promise.race([
    fetch(uri),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Read timeout')), UPLOAD_TIMEOUT_MS)),
  ]);
  const blob = await (fileRes as Response).blob();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.log('[storage] upload error', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
