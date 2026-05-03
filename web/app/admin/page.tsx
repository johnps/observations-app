import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

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
  return (
    <main className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Admin</h1>
        <SignOutButton />
      </div>
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
  );
}
