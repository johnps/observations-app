'use client';

import { useEffect, useState } from 'react';

type Tag = { id: string; name: string; description: string | null; retired: boolean };

export default function AdminTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  async function loadTags() {
    const res = await fetch('/api/tags');
    const b = await res.json();
    setTags(b.tags ?? []);
  }

  useEffect(() => { loadTags(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    });
    setName(''); setDescription(''); setAdding(false); loadTags();
  }

  async function handleRetire(id: string, retired: boolean) {
    await fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retired }),
    });
    loadTags();
  }

  async function handleSaveDesc(id: string) {
    await fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: editDesc }),
    });
    setEditingId(null); loadTags();
  }

  async function handleRunTagging() {
    setRunning(true); setRunResult(null);
    const res = await fetch('/api/observations/tag', { method: 'POST' });
    const b = await res.json();
    setRunResult(`Tagged ${b.tagged} of ${b.total} observations`);
    setRunning(false);
  }

  return (
    <main className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Tag Definitions</h1>
        <button onClick={handleRunTagging} disabled={running}
          className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
          {running ? 'Running…' : 'Run Tagging'}
        </button>
      </div>

      {runResult && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{runResult}</p>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input placeholder="Tag name" value={name} onChange={e => setName(e.target.value)}
          className="border border-gray-200 rounded px-3 py-2 text-sm flex-shrink-0 w-40" />
        <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)}
          className="border border-gray-200 rounded px-3 py-2 text-sm flex-1" />
        <button type="submit" disabled={adding}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">Add</button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Description</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {tags.map(tag => (
            <tr key={tag.id} className={`border-b border-gray-100 ${tag.retired ? 'opacity-40' : ''}`}>
              <td className="py-3 text-gray-800 font-mono text-xs">
                {tag.name}
                {tag.retired && <span className="ml-2 text-xs font-sans text-gray-400 font-normal">retired</span>}
              </td>
              <td className="py-3 text-gray-600">
                {editingId === tag.id ? (
                  <span className="flex gap-2 items-center">
                    <input autoFocus value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm flex-1" />
                    <button onClick={() => handleSaveDesc(tag.id)} className="text-xs text-green-700 hover:text-green-900">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </span>
                ) : (
                  <span className="flex gap-2 items-center group">
                    {tag.description}
                    <button onClick={() => { setEditingId(tag.id); setEditDesc(tag.description ?? ''); }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-700">Edit</button>
                  </span>
                )}
              </td>
              <td className="py-3 text-right">
                {tag.retired ? (
                  <button onClick={() => handleRetire(tag.id, false)}
                    className="text-gray-500 hover:text-gray-700 text-xs border border-gray-200 rounded px-2 py-1">Unretire</button>
                ) : (
                  <button onClick={() => handleRetire(tag.id, true)}
                    className="text-amber-600 hover:text-amber-800 text-xs">Retire</button>
                )}
              </td>
            </tr>
          ))}
          {tags.length === 0 && (
            <tr><td colSpan={3} className="py-8 text-center text-gray-400">No tags yet</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
