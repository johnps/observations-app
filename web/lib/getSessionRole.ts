import { supabase } from './supabase';

export async function getSessionRole(): Promise<{ role: string | null; district_name: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) return { role: null, district_name: null };

  try {
    const res = await fetch(`/api/users/role?email=${encodeURIComponent(session.user.email)}`);
    if (!res.ok) return { role: null, district_name: null };
    const { role, district_name } = await res.json();
    return { role: role ?? null, district_name: district_name ?? null };
  } catch {
    return { role: null, district_name: null };
  }
}
