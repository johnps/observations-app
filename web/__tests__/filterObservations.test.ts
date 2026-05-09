import { filterObservations, type FilterValues } from '../lib/filterObservations';

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

function obs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: '1',
    text: 'test',
    field_worker_name: 'Worker A',
    village_name: 'Village X',
    block_lead_email: 'lead@example.com',
    gps_captured: true,
    gps_lat: 10,
    gps_lng: 20,
    photo_urls: [],
    tags: ['health'],
    submitted_at: new Date().toISOString(),
    district_name: 'District D',
    block_name: 'Block B',
    ...overrides,
  };
}

const noFilters: FilterValues = {
  fDistrict: '', fBlock: '', fBlockLead: '',
  fFieldWorker: '', fVillage: '', fTag: '', fGps: '',
};

test('no active filters passes all observations', () => {
  expect(filterObservations(obs(), noFilters)).toBe(true);
});

test('block filter reduces to matching observations only', () => {
  const filters = { ...noFilters, fBlock: 'Block B' };
  expect(filterObservations(obs({ block_name: 'Block B' }), filters)).toBe(true);
  expect(filterObservations(obs({ block_name: 'Block C' }), filters)).toBe(false);
});

test('GPS filter "captured" returns only gps_captured === true observations', () => {
  const filters = { ...noFilters, fGps: 'captured' };
  expect(filterObservations(obs({ gps_captured: true }), filters)).toBe(true);
  expect(filterObservations(obs({ gps_captured: false }), filters)).toBe(false);
});

test('GPS filter "missing" returns only gps_captured === false observations', () => {
  const filters = { ...noFilters, fGps: 'missing' };
  expect(filterObservations(obs({ gps_captured: false }), filters)).toBe(true);
  expect(filterObservations(obs({ gps_captured: true }), filters)).toBe(false);
});

test('multiple active filters are AND-combined', () => {
  const filters = { ...noFilters, fBlock: 'Block B', fFieldWorker: 'Worker A' };
  expect(filterObservations(obs({ block_name: 'Block B', field_worker_name: 'Worker A' }), filters)).toBe(true);
  expect(filterObservations(obs({ block_name: 'Block B', field_worker_name: 'Worker X' }), filters)).toBe(false);
  expect(filterObservations(obs({ block_name: 'Block C', field_worker_name: 'Worker A' }), filters)).toBe(false);
});

test('clearing a filter returns all observations', () => {
  const withFilter = { ...noFilters, fBlock: 'Block B' };
  const cleared = { ...withFilter, fBlock: '' };
  expect(filterObservations(obs({ block_name: 'Block C' }), withFilter)).toBe(false);
  expect(filterObservations(obs({ block_name: 'Block C' }), cleared)).toBe(true);
});

test('tag filter matches observations containing the tag', () => {
  const filters = { ...noFilters, fTag: 'health' };
  expect(filterObservations(obs({ tags: ['health', 'water'] }), filters)).toBe(true);
  expect(filterObservations(obs({ tags: ['water'] }), filters)).toBe(false);
  expect(filterObservations(obs({ tags: [] }), filters)).toBe(false);
});
