'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SignOutButton } from '@/components/SignOutButton';

type Observation = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  gps_captured: boolean;
  gps_lat: number | null;
  gps_lng: number | null;
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

function DistrictLeadObservationsInner() {
  const searchParams = useSearchParams();
  const districtFilter = searchParams.get('district');

  const [observations, setObservations] = useState<Observation[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [dimension, setDimension] = useState<Dimension>('block_lead');
  const [period, setPeriod] = useState<Period>('this_month');
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);

  useEffect(() => {
    fetch(districtFilter ? `/api/observations?district=${encodeURIComponent(districtFilter)}` : '/api/observations')
      .then(r => r.json())
      .then(b => setObservations(b.observations ?? []));
  }, [districtFilter]);

  useEffect(() => {
    const base = `/api/observations/stats?dimension=${dimension}&period=${period}`;
    const url = districtFilter ? `${base}&district=${encodeURIComponent(districtFilter)}` : base;
    fetch(url)
      .then(r => r.json())
      .then(b => setStats(b.stats ?? []));
  }, [dimension, period, districtFilter]);

  return (
    <main className="p-8 max-w-6xl">
      {districtFilter && (
        <p className="text-sm text-gray-500 mb-2">
          <a href="/state-lead" className="text-gray-400 hover:text-gray-700">← State Overview</a>
          {' / '}{districtFilter}
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Observations</h1>
        <SignOutButton />
      </div>

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
            <>
              <tr
                key={obs.id}
                className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedObs(obs === selectedObs ? null : obs)}
              >
                <td className="py-3">{obs.gps_captured ? '✅' : '🚩'}</td>
                <td className="py-3 text-gray-700">{obs.field_worker_name}</td>
                <td className="py-3 text-gray-700">{obs.village_name}</td>
                <td className="py-3 text-gray-500 text-xs">{obs.block_lead_email}</td>
                <td className="py-3 text-gray-600 max-w-xs truncate">{obs.text}</td>
                <td className="py-3 text-gray-400 text-xs">
                  {new Date(obs.submitted_at).toLocaleDateString('en-IN')}
                </td>
              </tr>
              {selectedObs?.id === obs.id && (
                <tr key={obs.id + '-detail'} className="bg-gray-50">
                  <td colSpan={6} className="px-3 py-3 text-sm text-gray-600">
                    <div className="flex gap-8">
                      <div>
                        <span className="font-medium text-gray-700">Full text: </span>
                        {obs.text}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">GPS: </span>
                        {obs.gps_lat && obs.gps_lng
                          ? `${obs.gps_lat.toFixed(5)}, ${obs.gps_lng.toFixed(5)}`
                          : 'Not captured'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
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

export default function DistrictLeadObservations() {
  return (
    <Suspense>
      <DistrictLeadObservationsInner />
    </Suspense>
  );
}
