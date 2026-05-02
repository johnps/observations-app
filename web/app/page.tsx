'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  district_lead: '/district-lead',
  block_lead: '/block-lead',
  state_lead: '/state-lead',
};

const PLACEHOLDER_EMAILS: { label: string; email: string }[] = [
  { label: 'Admin', email: 'test-admin@placeholder.local' },
  { label: 'District Lead', email: 'test-district-lead@placeholder.local' },
  { label: 'Block Lead', email: 'test-block-lead@placeholder.local' },
  { label: 'State Lead', email: 'test-state-lead@placeholder.local' },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function handleLogin(email: string) {
    setError('');
    const res = await fetch(`/api/users/role?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      setError('Role not found. Check that this account is set up in User Management.');
      return;
    }
    const { role } = await res.json();
    router.push(ROLE_HOME[role] ?? '/');
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-800">Livelihood Monitor</h1>
      <p className="text-gray-500">Select your role to continue</p>
      <div className="flex flex-col gap-3 w-64">
        {PLACEHOLDER_EMAILS.map(({ label, email }) => (
          <button
            key={label}
            onClick={() => handleLogin(email)}
            className="w-full py-3 px-6 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm max-w-xs text-center">{error}</p>}
    </main>
  );
}
