export type FilterValues = {
  fDistrict: string;
  fBlock: string;
  fBlockLead: string;
  fFieldWorker: string;
  fVillage: string;
  fTag: string;
  fGps: string;
};

type Observation = {
  district_name?: string;
  block_name?: string;
  block_lead_email: string;
  field_worker_name: string;
  village_name: string;
  tags: string[];
  gps_captured: boolean;
};

export function filterObservations(obs: Observation, f: FilterValues): boolean {
  if (f.fDistrict && obs.district_name !== f.fDistrict) return false;
  if (f.fBlock && obs.block_name !== f.fBlock) return false;
  if (f.fBlockLead && obs.block_lead_email !== f.fBlockLead) return false;
  if (f.fFieldWorker && obs.field_worker_name !== f.fFieldWorker) return false;
  if (f.fVillage && obs.village_name !== f.fVillage) return false;
  if (f.fTag && !(obs.tags ?? []).includes(f.fTag)) return false;
  if (f.fGps === 'captured' && !obs.gps_captured) return false;
  if (f.fGps === 'missing' && obs.gps_captured) return false;
  return true;
}
