'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function SignOutButton() {
  const router = useRouter();
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }
  return (
    <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600 transition">
      Sign out
    </button>
  );
}
