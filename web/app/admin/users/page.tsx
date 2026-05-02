'use client';

import { useEffect, useState } from 'react';
import { SignOutButton } from '@/components/SignOutButton';

type Role = 'admin' | 'district_lead' | 'block_lead' | 'state_lead';

type User = {
  id: string;
  email: string;
  role: Role;
  state_name: string | null;
  district_name: string | null;
  block_name: string | null;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  district_lead: 'District Lead',
  block_lead: 'Block Lead',
  state_lead: 'State Lead',
};

const GEOGRAPHY_FIELD: Partial<Record<Role, string>> = {
  district_lead: 'district_name',
  block_lead: 'block_name',
  state_lead: 'state_name',
};

const GEOGRAPHY_LABEL: Partial<Record<Role, string>> = {
  district_lead: 'District Name',
  block_lead: 'Block Name',
  state_lead: 'State Name',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [geography, setGeography] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadUsers() {
    const res = await fetch('/api/users');
    const body = await res.json();
    setUsers(body.users ?? []);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    const geoField = GEOGRAPHY_FIELD[role];
    const payload: Record<string, string> = { email, role };
    if (geoField) payload[geoField] = geography;

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to save user');
      setSaving(false);
      return;
    }

    setShowForm(false);
    setEmail('');
    setRole('admin');
    setGeography('');
    setSaving(false);
    loadUsers();
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    loadUsers();
  }

  const geoLabel = GEOGRAPHY_LABEL[role];

  return (
    <main className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">User Management</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Add User
          </button>
          <SignOutButton />
        </div>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white flex flex-col gap-3 max-w-md">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium text-gray-700">Role</label>
            <select
              id="role"
              value={role}
              onChange={e => { setRole(e.target.value as Role); setGeography(''); }}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {geoLabel && (
            <div className="flex flex-col gap-1">
              <label htmlFor="geography" className="text-sm font-medium text-gray-700">{geoLabel}</label>
              <input
                id="geography"
                type="text"
                value={geography}
                onChange={e => setGeography(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 font-medium">Email</th>
            <th className="pb-2 font-medium">Role</th>
            <th className="pb-2 font-medium">Geography</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="border-b border-gray-100">
              <td className="py-3 text-gray-800">{user.email}</td>
              <td className="py-3 text-gray-600">{ROLE_LABELS[user.role]}</td>
              <td className="py-3 text-gray-600">
                {user.district_name ?? user.block_name ?? user.state_name ?? '—'}
              </td>
              <td className="py-3 text-right">
                <button
                  onClick={() => handleRevoke(user.id)}
                  className="px-3 py-1 text-red-600 border border-red-200 rounded text-xs hover:bg-red-50"
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
