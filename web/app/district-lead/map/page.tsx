'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TopNav } from '@/components/TopNav';
import { getSessionRole } from '@/lib/getSessionRole';
import { useFilterState } from '@/hooks/useFilterState';

const DistrictLeadMap = dynamic(
  () => import('@/components/DistrictLeadMap').then(m => m.DistrictLeadMap),
  { ssr: false }
);

type Observation = {
  id: string;
  text: string;
  field_worker_name: string;
  village_name: string;
  block_lead_email: string;
  gps_captured: boolean;
  gps_lat: number | null;
  gps_lng: number | null;
  photo_urls: string[];
  tags: string[];
  submitted_at: string;
  district_name?: string;
  block_name?: string;
};

function ColFilter({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="ml-2 border border-slate-200 rounded px-2 py-1 text-sm text-slate-700"
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function DistrictLeadMapInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromStateLead = searchParams.get('from') === 'state-lead';
  const urlDistrict = searchParams.get('district');

  const [sessionDistrict, setSessionDistrict] = useState<string | null>(null);
  const [navFullName, setNavFullName] = useState<string | null>(null);
  const [navEmail, setNavEmail] = useState<string | null>(null);
  const districtFilter = fromStateLead ? urlDistrict : sessionDistrict;

  useEffect(() => {
    if (fromStateLead) return;
    getSessionRole().then(({ role, district_name, fullName, email }) => {
      if (role !== 'district_lead') { router.replace('/'); return; }
      setSessionDistrict(district_name);
      setNavFullName(fullName);
      setNavEmail(email);
    });
  }, [fromStateLead, router]);

  const [observations, setObservations] = useState<Observation[]>([]);

  useEffect(() => {
    if (!districtFilter) return;
    Promise.all([
      fetch(`/api/observations?district=${encodeURIComponent(districtFilter)}`).then(r => r.json()),
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
  }, [districtFilter]);

  const gpsObservations = useMemo(
    () => observations.filter(o => o.gps_captured && o.gps_lat != null && o.gps_lng != null),
    [observations],
  );

  const {
    fBlock, setFBlock, fFieldWorker, setFFieldWorker,
    fVillage, setFVillage, fTag, setFTag,
    filteredObservations, opts, hasFilters, clearFilters,
  } = useFilterState(gpsObservations);

  const pins = filteredObservations.map(o => ({ lat: o.gps_lat!, lng: o.gps_lng! }));

  const center = useMemo<[number, number]>(() => {
    if (gpsObservations.length === 0) return INDIA_CENTER;
    const avgLat = gpsObservations.reduce((s, o) => s + o.gps_lat!, 0) / gpsObservations.length;
    const avgLng = gpsObservations.reduce((s, o) => s + o.gps_lng!, 0) / gpsObservations.length;
    return [avgLat, avgLng];
  }, [gpsObservations]);

  return (
    <>
      <TopNav role="district_lead" fullName={navFullName} email={navEmail} />
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-white flex-wrap">
          <ColFilter label="Block" options={opts.blocks} value={fBlock} onChange={setFBlock} />
          <ColFilter label="Field Worker" options={opts.fieldWorkers} value={fFieldWorker} onChange={setFFieldWorker} />
          <ColFilter label="Village" options={opts.villages} value={fVillage} onChange={setFVillage} />
          <ColFilter label="Tag" options={opts.tags} value={fTag} onChange={setFTag} />
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600">
              Clear filters
            </button>
          )}
        </div>
        <div className="relative flex-1">
          <DistrictLeadMap center={center} zoom={13} pins={pins} />
          {pins.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="bg-white/90 text-slate-500 text-sm rounded px-4 py-2 shadow">
                No GPS observations match the current filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DistrictLeadMapPage() {
  return <Suspense><DistrictLeadMapInner /></Suspense>;
}
