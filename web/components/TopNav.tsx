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
    <nav className="flex items-center gap-6 px-6 py-3 bg-teal-700 text-sm">
      <div className="flex gap-4 flex-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={
              pathname === href
                ? 'font-semibold text-white'
                : 'text-teal-200 hover:text-white transition-colors'
            }
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-teal-200">
        {fullName && <span>{fullName}</span>}
        {email && <span>{email}</span>}
        <button
          onClick={handleSignOut}
          className="text-teal-300 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
