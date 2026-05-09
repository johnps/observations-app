'use client';

import { useMemo, useState } from 'react';
import { filterObservations, type FilterValues } from '@/lib/filterObservations';

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

function uniq(arr: string[]) { return Array.from(new Set(arr)).sort(); }

export function useFilterState(observations: Observation[]) {
  const [fDistrict, setFDistrict] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fBlockLead, setFBlockLead] = useState('');
  const [fFieldWorker, setFFieldWorker] = useState('');
  const [fVillage, setFVillage] = useState('');
  const [fTag, setFTag] = useState('');
  const [fGps, setFGps] = useState('');

  const filters: FilterValues = { fDistrict, fBlock, fBlockLead, fFieldWorker, fVillage, fTag, fGps };

  const filteredObservations = useMemo(
    () => observations.filter(o => filterObservations(o, filters)),
    [observations, fDistrict, fBlock, fBlockLead, fFieldWorker, fVillage, fTag, fGps],
  );

  const opts = useMemo(() => ({
    districts: uniq(observations.map(o => o.district_name ?? '').filter(Boolean)),
    blocks: uniq(observations.map(o => o.block_name ?? '').filter(Boolean)),
    blockLeads: uniq(observations.map(o => o.block_lead_email)),
    fieldWorkers: uniq(observations.map(o => o.field_worker_name)),
    villages: uniq(observations.map(o => o.village_name)),
    tags: uniq(observations.flatMap(o => o.tags ?? [])),
  }), [observations]);

  const hasFilters = !!(fDistrict || fBlock || fBlockLead || fFieldWorker || fVillage || fTag || fGps);

  function clearFilters() {
    setFDistrict(''); setFBlock(''); setFBlockLead('');
    setFFieldWorker(''); setFVillage(''); setFTag(''); setFGps('');
  }

  return {
    fDistrict, setFDistrict,
    fBlock, setFBlock,
    fBlockLead, setFBlockLead,
    fFieldWorker, setFFieldWorker,
    fVillage, setFVillage,
    fTag, setFTag,
    fGps, setFGps,
    filteredObservations,
    opts,
    hasFilters,
    clearFilters,
  };
}
