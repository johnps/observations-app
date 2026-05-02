'use client';

import { useEffect, useState } from 'react';

type Observation = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  gps_captured: boolean;
  submitted_at: string;
};

export default function DistrictLeadObservations() {
  const [observations, setObservations] = useState<Observation[]>([]);

  useEffect(() => {
    fetch('/api/observations')
      .then(r => r.json())
      .then(b => setObservations(b.observations ?? []));
  }, []);

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Observations</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 font-medium">GPS</th>
            <th className="pb-2 font-medium">Field Worker</th>
            <th className="pb-2 font-medium">Village</th>
            <th className="pb-2 font-medium">Block Lead</th>
            <th className="pb-2 font-medium">Observation</th>
            <th className="pb-2 font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {observations.map(obs => (
            <tr key={obs.id} className="border-b border-gray-100">
              <td className="py-3">{obs.gps_captured ? '✅' : '🚩'}</td>
              <td className="py-3 text-gray-700">{obs.field_worker_name}</td>
              <td className="py-3 text-gray-700">{obs.village_name}</td>
              <td className="py-3 text-gray-500 text-xs">{obs.block_lead_email}</td>
              <td className="py-3 text-gray-600 max-w-xs truncate">{obs.text}</td>
              <td className="py-3 text-gray-400 text-xs">
                {new Date(obs.submitted_at).toLocaleDateString('en-IN')}
              </td>
            </tr>
          ))}
          {observations.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-400">No observations yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
