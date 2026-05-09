'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type NavLink = { href: string; label: string };

const ROLE_LINKS: Record<string, NavLink[]> = {
  district_lead: [
    { href: '/district-lead/observations', label: 'Observations' },
    { href: '/district-lead/map', label: 'Map' },
  ],
  state_lead: [
    { href: '/state-lead', label: 'Overview' },
  ],
  admin: [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/hierarchy', label: 'Hierarchy' },
    { href: '/admin/tags', label: 'Tags' },
  ],
};

type Props = {
  role: string | null;
  fullName: string | null;
  email: string | null;
};

export function TopNav({ role, fullName, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const links = (role ? ROLE_LINKS[role] : undefined) ?? [];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <nav className="flex items-center gap-6 px-6 py-3 border-b border-gray-200 bg-white text-sm">
      <div className="flex gap-4 flex-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={
              pathname === href
                ? 'font-semibold text-gray-900'
                : 'text-gray-500 hover:text-gray-800'
            }
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {fullName && <span>{fullName}</span>}
        {email && <span>{email}</span>}
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
