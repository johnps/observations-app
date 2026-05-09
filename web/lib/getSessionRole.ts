import { supabase } from './supabase';

export async function getSessionRole(): Promise<{
  role: string | null;
  district_name: string | null;
  fullName: string | null;
  email: string | null;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;
  const fullName = session?.user?.user_metadata?.full_name ?? null;
  if (!email) return { role: null, district_name: null, fullName: null, email: null };

  try {
    const res = await fetch(`/api/users/role?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { role: null, district_name: null, fullName, email };
    const { role, district_name } = await res.json();
    return { role: role ?? null, district_name: district_name ?? null, fullName, email };
  } catch {
    return { role: null, district_name: null, fullName, email };
  }
}
