'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { getSessionRole } from '@/lib/getSessionRole';

const SECTIONS = [
  {
    href: '/admin/users',
    title: 'User Management',
    description: 'Add or revoke user accounts and assign roles.',
  },
  {
    href: '/admin/hierarchy',
    title: 'Hierarchy Upload',
    description: 'Upload the CSV mapping states → districts → blocks → field workers → villages.',
  },
  {
    href: '/admin/tags',
    title: 'Tag Definitions',
    description: 'Add, edit, or retire activity tags used for AI auto-tagging.',
  },
];

export default function AdminHome() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [navFullName, setNavFullName] = useState<string | null>(null);
  const [navEmail, setNavEmail] = useState<string | null>(null);

  useEffect(() => {
    getSessionRole().then(({ role, fullName, email }) => {
      if (role !== 'admin') { router.replace('/'); return; }
      setAuthChecked(true);
      setNavFullName(fullName);
      setNavEmail(email);
    });
  }, [router]);

  if (!authChecked) return null;

  return (
    <>
      <TopNav role="admin" fullName={navFullName} email={navEmail} />
      <main className="p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-800 mb-8">Admin</h1>
        <div className="grid gap-4">
          {SECTIONS.map(({ href, title, description }) => (
            <Link
              key={href}
              href={href}
              className="block p-5 border border-gray-200 rounded-lg bg-white hover:border-gray-400 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
              <p className="text-sm text-gray-500">{description}</p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
