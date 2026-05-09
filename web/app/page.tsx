'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  district_lead: '/district-lead/observations',
  block_lead: '/block-lead',
  state_lead: '/state-lead',
};

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        await routeByRole(session.user.email);
      } else {
        setChecking(false);
      }
    });
  }, []);

  async function routeByRole(email: string) {
    const url = `/api/users/role?email=${encodeURIComponent(email)}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const { role } = await res.json();
          if (ROLE_ROUTES[role]) {
            router.replace(ROLE_ROUTES[role]);
            return;
          }
          break; // role unrecognised — retrying won't help
        }
      } catch { /* transient — try again */ }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    setNoAccess(true);
    setChecking(false);
  }

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setNoAccess(false);
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-800">Livelihood Monitor</h1>
      {noAccess ? (
        <>
          <p className="text-sm text-red-600 max-w-xs text-center">
            Your account hasn&apos;t been assigned a role. Contact your administrator.
          </p>
          <button onClick={handleSignOut} className="text-sm text-slate-400 underline">
            Sign out
          </button>
        </>
      ) : (
        <button
          onClick={handleSignIn}
          className="flex items-center gap-3 border border-slate-200 rounded-lg px-5 py-3 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 13.837 17.64 11.53 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      )}
    </main>
  );
}
