import { File } from 'expo-file-system';
import { supabase } from './supabase';

const BUCKET = 'observation-photos';

export async function uploadPhoto(uri: string, obsId: string, index: number): Promise<string> {
  const path = `${obsId}/${index}.jpg`;

  const fileBytes = await new File(uri).bytes();
  const blob = new Blob([fileBytes], { type: 'image/jpeg' });

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
