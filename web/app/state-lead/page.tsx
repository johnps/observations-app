'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SignOutButton } from '@/components/SignOutButton';

type Stat = { name: string; count: number };
type Period = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';
type Dimension = 'district' | 'block_lead' | 'field_worker' | 'village' | 'tag';

const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month', last_month: 'Last Month',
  last_3_months: 'Last 3 Months', last_6_months: 'Last 6 Months',
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  district: 'District', block_lead: 'Block Lead',
  field_worker: 'Field Worker', village: 'Village', tag: 'Tag',
};

export default function StateLeadDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stat[]>([]);
  const [period, setPeriod] = useState<Period>('this_month');
  const [dimension, setDimension] = useState<Dimension>('district');

  useEffect(() => {
    fetch(`/api/observations/stats?dimension=${dimension}&period=${period}`)
      .then(r => r.json())
      .then(b => setStats(b.stats ?? []));
  }, [period, dimension]);

  function handleBarClick(e: any) {
    if (dimension === 'district' && e?.activePayload?.[0]?.payload?.name) {
      router.push(`/state-lead/district/${encodeURIComponent(e.activePayload[0].payload.name)}`);
    }
  }

  return (
    <main className="p-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex-1">State Overview</h1>
        <label className="text-sm font-medium text-gray-600">
          Dimension
          <select aria-label="Dimension" value={dimension} onChange={e => setDimension(e.target.value as Dimension)}
            className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700">
            {(Object.keys(DIMENSION_LABELS) as Dimension[]).map(d => (
              <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-600">
          Period
          <select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value as Period)}
            className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <SignOutButton />
      </div>

      {dimension === 'district' && (
        <p className="text-sm text-gray-400 mb-4">Click a district bar to see full district view</p>
      )}

      <div data-testid="state-chart" className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ top: 4, right: 8, left: 0, bottom: 48 }} onClick={handleBarClick}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}
              style={{ cursor: dimension === 'district' ? 'pointer' : 'default' }}>
              {stats.map((s, i) => (
                <Cell key={i} fill={s.count === 0 ? '#e5e7eb' : '#111827'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats.length === 0 && (
        <p className="text-center text-gray-400 text-sm mt-8">No data for this period</p>
      )}
    </main>
  );
}
