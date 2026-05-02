'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Observation = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  gps_captured: boolean;
  submitted_at: string;
};

type Stat = { name: string; count: number };

type Dimension = 'block_lead' | 'field_worker' | 'village' | 'tag';
type Period = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

const DIMENSION_LABELS: Record<Dimension, string> = {
  block_lead: 'Block Lead',
  field_worker: 'Field Worker',
  village: 'Village',
  tag: 'Tag',
};

const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_3_months: 'Last 3 Months',
  last_6_months: 'Last 6 Months',
};

export default function DistrictLeadObservations() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [dimension, setDimension] = useState<Dimension>('block_lead');
  const [period, setPeriod] = useState<Period>('this_month');

  useEffect(() => {
    fetch('/api/observations')
      .then(r => r.json())
      .then(b => setObservations(b.observations ?? []));
  }, []);

  useEffect(() => {
    fetch(`/api/observations/stats?dimension=${dimension}&period=${period}`)
      .then(r => r.json())
      .then(b => setStats(b.stats ?? []));
  }, [dimension, period]);

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Observations</h1>

      <div className="mb-6 flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-600">
          Dimension
          <select
            aria-label="Dimension"
            className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700"
            value={dimension}
            onChange={e => setDimension(e.target.value as Dimension)}
          >
            {(Object.keys(DIMENSION_LABELS) as Dimension[]).map(d => (
              <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-600">
          Period
          <select
            aria-label="Period"
            className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700"
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
          >
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </label>
      </div>

      <div data-testid="frequency-chart" className="mb-8 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {stats.map((s, i) => (
                <Cell key={i} fill={s.count === 0 ? '#e5e7eb' : '#111827'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
