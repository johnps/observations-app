'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SignOutButton } from '@/components/SignOutButton';

type Stat = { name: string; count: number };
type Period = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_3_months: 'Last 3 Months',
  last_6_months: 'Last 6 Months',
};

export default function StateLeadDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [period, setPeriod] = useState<Period>('this_month');
  const [drillDistrict, setDrillDistrict] = useState<string | null>(null);

  useEffect(() => {
    const url = drillDistrict
      ? `/api/state-lead/stats?district=${encodeURIComponent(drillDistrict)}&period=${period}`
      : `/api/state-lead/stats?period=${period}`;
    fetch(url)
      .then(r => r.json())
      .then(b => setStats(b.stats ?? []));
  }, [period, drillDistrict]);

  return (
    <main className="p-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex-1">
          {drillDistrict ? (
            <>
              <button
                onClick={() => setDrillDistrict(null)}
                className="text-gray-400 hover:text-gray-700 mr-2"
              >
                ← All Districts
              </button>
              {drillDistrict}
            </>
          ) : 'State Overview'}
        </h1>

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
        <SignOutButton />
      </div>

      {!drillDistrict && (
        <p className="text-sm text-gray-400 mb-4">Click a district bar to drill down</p>
      )}

      <div data-testid="state-chart" className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stats}
            margin={{ top: 4, right: 8, left: 0, bottom: 48 }}
            onClick={(e: any) => {
              if (!drillDistrict && e?.activePayload?.[0]?.payload?.name) {
                setDrillDistrict(e.activePayload[0].payload.name);
              }
            }}
          >
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} style={{ cursor: drillDistrict ? 'default' : 'pointer' }}>
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
