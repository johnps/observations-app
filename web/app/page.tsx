'use client';

import { useRouter } from 'next/navigation';

const ROLES = [
  { label: 'Admin', path: '/admin' },
  { label: 'District Lead', path: '/district-lead' },
  { label: 'Block Lead', path: '/block-lead' },
  { label: 'State Lead', path: '/state-lead' },
] as const;

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-800">Livelihood Monitor</h1>
      <p className="text-gray-500">Select your role to continue</p>
      <div className="flex flex-col gap-3 w-64">
        {ROLES.map(({ label, path }) => (
          <button
            key={label}
            onClick={() => router.push(path)}
            className="w-full py-3 px-6 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}
