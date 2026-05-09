'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SignOutButton } from '@/components/SignOutButton';
import { getSessionRole } from '@/lib/getSessionRole';

type Observation = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  gps_captured: boolean;
  gps_lat: number | null;
  gps_lng: number | null;
  tags: string[];
  submitted_at: string;
  district_name?: string;
  block_name?: string;
};

type Stat = { name: string; count: number };
type Dimension = 'block_lead' | 'field_worker' | 'village' | 'tag';
type Period = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

const DIMENSION_LABELS: Record<Dimension, string> = {
  block_lead: 'Block Lead', field_worker: 'Field Worker', village: 'Village', tag: 'Tag',
};
const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month', last_month: 'Last Month',
  last_3_months: 'Last 3 Months', last_6_months: 'Last 6 Months',
};

function uniq(arr: string[]) { return Array.from(new Set(arr)).sort(); }

function ColFilter({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="mt-1 w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-600 font-normal bg-white"
    >
      <option value="">All</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function DistrictLeadObservationsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromStateLead = searchParams.get('from') === 'state-lead';
  const urlDistrict = searchParams.get('district');

  const [sessionDistrict, setSessionDistrict] = useState<string | null>(null);
  const districtFilter = fromStateLead ? urlDistrict : sessionDistrict;

  useEffect(() => {
    if (fromStateLead) return;
    getSessionRole().then(({ role, district_name }) => {
      if (role !== 'district_lead') { router.replace('/'); return; }
      setSessionDistrict(district_name);
    });
  }, [fromStateLead, router]);

  const [observations, setObservations] = useState<Observation[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [dimension, setDimension] = useState<Dimension>('block_lead');
  const [period, setPeriod] = useState<Period>('this_month');
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);

  const [fDistrict, setFDistrict] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fBlockLead, setFBlockLead] = useState('');
  const [fFieldWorker, setFFieldWorker] = useState('');
  const [fVillage, setFVillage] = useState('');
  const [fTag, setFTag] = useState('');
  const [fGps, setFGps] = useState('');

  const [tagging, setTagging] = useState(false);
  const [tagResult, setTagResult] = useState<string | null>(null);

  function loadObservations() {
    const url = districtFilter
      ? `/api/observations?district=${encodeURIComponent(districtFilter)}`
      : '/api/observations';
    Promise.all([
      fetch(url).then(r => r.json()),
      fetch('/api/hierarchy/email-map').then(r => r.json()),
    ]).then(([obsBody, hierBody]) => {
      const emailMap: Record<string, { district_name: string; block_name: string }> = hierBody.map ?? {};
      const enriched = (obsBody.observations ?? []).map((o: Observation) => ({
        ...o,
        tags: o.tags ?? [],
        district_name: emailMap[o.block_lead_email]?.district_name ?? '—',
        block_name: emailMap[o.block_lead_email]?.block_name ?? '—',
      }));
      setObservations(enriched);
    });
  }

  useEffect(() => { if (!districtFilter) return; loadObservations(); }, [districtFilter]);

  async function handleAutoTag() {
    if (!districtFilter) return;
    setTagging(true);
    setTagResult(null);
    const res = await fetch(`/api/observations/tag?district=${encodeURIComponent(districtFilter)}`, { method: 'POST' });
    const body = await res.json();
    setTagResult(body.total === 0 ? 'Nothing to tag' : `${body.tagged} of ${body.total} observations tagged`);
    setTagging(false);
    loadObservations();
  }

  useEffect(() => {
    if (!districtFilter) return;
    const base = `/api/observations/stats?dimension=${dimension}&period=${period}`;
    fetch(`${base}&district=${encodeURIComponent(districtFilter)}`).then(r => r.json()).then(b => setStats(b.stats ?? []));
  }, [dimension, period, districtFilter]);

  const filtered = useMemo(() => observations.filter(o => {
    if (fDistrict && o.district_name !== fDistrict) return false;
    if (fBlock && o.block_name !== fBlock) return false;
    if (fBlockLead && o.block_lead_email !== fBlockLead) return false;
    if (fFieldWorker && o.field_worker_name !== fFieldWorker) return false;
    if (fVillage && o.village_name !== fVillage) return false;
    if (fTag && !(o.tags ?? []).includes(fTag)) return false;
    if (fGps === 'captured' && !o.gps_captured) return false;
    if (fGps === 'missing' && o.gps_captured) return false;
    return true;
  }), [observations, fDistrict, fBlock, fBlockLead, fFieldWorker, fVillage, fTag, fGps]);

  const opts = useMemo(() => ({
    districts: uniq(observations.map(o => o.district_name ?? '').filter(Boolean)),
    blocks: uniq(observations.map(o => o.block_name ?? '').filter(Boolean)),
    blockLeads: uniq(observations.map(o => o.block_lead_email)),
    fieldWorkers: uniq(observations.map(o => o.field_worker_name)),
    villages: uniq(observations.map(o => o.village_name)),
    tags: uniq(observations.flatMap(o => o.tags ?? [])),
  }), [observations]);

  const hasFilters = fDistrict || fBlock || fBlockLead || fFieldWorker || fVillage || fTag || fGps;

  return (
    <main className="p-8 max-w-7xl">
      {fromStateLead && districtFilter && (
        <p className="text-sm text-gray-500 mb-2">
          <a href="/state-lead" className="text-gray-400 hover:text-gray-700">← State Overview</a>
          {' / '}{districtFilter}
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Observations</h1>
        <div className="flex items-center gap-4">
          {districtFilter && (() => {
            const untaggedCount = observations.filter(o => !o.tags?.length).length;
            return (
              <div className="flex items-center gap-2">
                {tagResult && <span className="text-xs text-gray-500">{tagResult}</span>}
                <button
                  onClick={handleAutoTag}
                  disabled={tagging}
                  className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {tagging ? 'Tagging…' : `Auto-tag Now${untaggedCount > 0 ? ` (${untaggedCount} untagged)` : ''}`}
                </button>
              </div>
            );
          })()}
          <SignOutButton />
        </div>
      </div>

      <div className="mb-4 flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-600">
          Dimension
          <select className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700"
            value={dimension} onChange={e => setDimension(e.target.value as Dimension)}>
            {(Object.keys(DIMENSION_LABELS) as Dimension[]).map(d => (
              <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-600">
          Period
          <select className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm text-gray-700"
            value={period} onChange={e => setPeriod(e.target.value as Period)}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-8 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {stats.map((s, i) => <Cell key={i} fill={s.count === 0 ? '#e5e7eb' : '#111827'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{filtered.length} of {observations.length} observations</span>
        {hasFilters && (
          <button onClick={() => { setFDistrict(''); setFBlock(''); setFBlockLead(''); setFFieldWorker(''); setFVillage(''); setFTag(''); setFGps(''); }}
            className="text-xs text-gray-400 hover:text-gray-600">
            Clear all filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-gray-600 bg-gray-50">
              <th className="px-3 pt-3 pb-1 font-medium w-10">
                GPS
                <ColFilter value={fGps} onChange={setFGps} options={['✅ Captured', '🚩 Missing']} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                District
                <ColFilter value={fDistrict} options={opts.districts} onChange={setFDistrict} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                Block
                <ColFilter value={fBlock} options={opts.blocks} onChange={setFBlock} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                Block Lead
                <ColFilter value={fBlockLead} options={opts.blockLeads} onChange={setFBlockLead} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                Field Worker
                <ColFilter value={fFieldWorker} options={opts.fieldWorkers} onChange={setFFieldWorker} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                Village
                <ColFilter value={fVillage} options={opts.villages} onChange={setFVillage} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">
                Tag
                <ColFilter value={fTag} options={opts.tags} onChange={setFTag} />
              </th>
              <th className="px-3 pt-3 pb-1 font-medium">Observation</th>
              <th className="px-3 pt-3 pb-1 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(obs => (
              <>
                <tr key={obs.id}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedObs(obs === selectedObs ? null : obs)}>
                  <td className="px-3 py-2">{obs.gps_captured ? '✅' : '🚩'}</td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{obs.district_name}</td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{obs.block_name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{obs.block_lead_email}</td>
                  <td className="px-3 py-2 text-gray-700">{obs.field_worker_name}</td>
                  <td className="px-3 py-2 text-gray-700">{obs.village_name}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(obs.tags ?? []).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{obs.text}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(obs.submitted_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
                {selectedObs?.id === obs.id && (
                  <tr key={obs.id + '-detail'} className="bg-gray-50">
                    <td colSpan={9} className="px-3 py-3 text-sm text-gray-600">
                      <div className="flex gap-8">
                        <div className="flex-1">
                          <span className="font-medium text-gray-700">Full text: </span>{obs.text}
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
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-gray-400">
                {observations.length === 0 ? 'No observations yet' : 'No observations match the current filters'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function DistrictLeadObservations() {
  return <Suspense><DistrictLeadObservationsInner /></Suspense>;
}
