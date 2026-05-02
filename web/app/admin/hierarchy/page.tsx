'use client';

import { useRef, useState } from 'react';

type ValidationError = { row: number; field: string; message: string };
type Preview = { adds: number; updates: number; removes: number };

type State =
  | { phase: 'idle' }
  | { phase: 'errors'; errors: ValidationError[] }
  | { phase: 'preview'; preview: Preview; file: File }
  | { phase: 'uploading' }
  | { phase: 'done'; result: { added: number; updated: number; removed: number } };

export default function AdminHierarchyPage() {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState({ phase: 'idle' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/hierarchy/validate', { method: 'POST', body: formData });
    const body = await res.json();

    if (!body.valid) {
      setState({ phase: 'errors', errors: body.errors });
    } else {
      setState({ phase: 'preview', preview: body.preview, file });
    }
  }

  async function handleConfirm() {
    if (state.phase !== 'preview') return;
    setState({ phase: 'uploading' });

    const formData = new FormData();
    formData.append('file', state.file);

    const res = await fetch('/api/hierarchy/upload', { method: 'POST', body: formData });
    const result = await res.json();
    setState({ phase: 'done', result });
    if (inputRef.current) inputRef.current.value = '';
  }

  function reset() {
    setState({ phase: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Hierarchy Management</h1>

      <div className="mb-4">
        <a
          href="/api/hierarchy/template"
          download="hierarchy-template.csv"
          className="text-sm text-blue-600 hover:underline"
        >
          Download template CSV
        </a>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload hierarchy CSV</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-sm text-gray-600"
        />
      </div>

      {state.phase === 'errors' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-red-700 mb-2">Validation errors — fix and re-upload:</p>
          <ul className="text-sm text-red-600 space-y-1 list-disc list-inside">
            {state.errors.map((e, i) => <li key={i}>{e.message}</li>)}
          </ul>
          <button onClick={reset} className="mt-3 text-sm text-red-700 underline">Clear</button>
        </div>
      )}

      {state.phase === 'preview' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-blue-800 mb-3">Preview changes</p>
          <div className="flex gap-6 text-sm text-blue-700 mb-4">
            <span><strong>{state.preview.adds}</strong> to add</span>
            <span><strong>{state.preview.updates}</strong> to update</span>
            <span><strong>{state.preview.removes}</strong> to remove</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700"
            >
              Confirm upload
            </button>
            <button onClick={reset} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.phase === 'uploading' && (
        <p className="text-sm text-gray-500">Uploading…</p>
      )}

      {state.phase === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-green-800">
            Successfully uploaded — {state.result.added} added, {state.result.updated} updated, {state.result.removed} removed
          </p>
          <button onClick={reset} className="mt-2 text-sm text-green-700 underline">Upload another</button>
        </div>
      )}
    </main>
  );
}
