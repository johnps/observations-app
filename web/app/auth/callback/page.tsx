'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => router.replace('/'));
    } else {
      router.replace('/');
    }
  }, [router, searchParams]);

  return <p className="text-gray-400 text-sm">Signing in…</p>;
}

export default function AuthCallback() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-400 text-sm">Loading…</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
