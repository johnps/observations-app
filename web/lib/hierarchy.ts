import { supabaseAdmin } from './supabase-admin';

export type GeoOption = { value: string; label: string };

export async function getGeographies(type: 'block' | 'district' | 'state'): Promise<GeoOption[]> {
  if (type === 'block') {
    const { data } = await supabaseAdmin
      .from('hierarchy')
      .select('block_name, district_name, state_name')
      .eq('status', 'active');
    const seen = new Set<string>();
    return (data ?? []).reduce<GeoOption[]>((acc, r) => {
      if (!seen.has(r.block_name + '|' + r.district_name)) {
        seen.add(r.block_name + '|' + r.district_name);
        acc.push({ value: r.block_name, label: `${r.block_name} (${r.district_name}, ${r.state_name})` });
      }
      return acc;
    }, []);
  }
  if (type === 'district') {
    const { data } = await supabaseAdmin
      .from('hierarchy')
      .select('district_name, state_name')
      .eq('status', 'active');
    const seen = new Set<string>();
    return (data ?? []).reduce<GeoOption[]>((acc, r) => {
      if (!seen.has(r.district_name + '|' + r.state_name)) {
        seen.add(r.district_name + '|' + r.state_name);
        acc.push({ value: r.district_name, label: `${r.district_name} (${r.state_name})` });
      }
      return acc;
    }, []);
  }
  // state
  const { data } = await supabaseAdmin
    .from('hierarchy')
    .select('state_name')
    .eq('status', 'active');
  const seen = new Set<string>();
  return (data ?? []).reduce<GeoOption[]>((acc, r) => {
    if (!seen.has(r.state_name)) {
      seen.add(r.state_name);
      acc.push({ value: r.state_name, label: r.state_name });
    }
    return acc;
  }, []);
}

export async function getFieldWorkers(blockLeadEmail: string) {
  const { data } = await supabaseAdmin
    .from('hierarchy')
    .select('field_worker_name')
    .eq('block_lead_email', blockLeadEmail)
    .eq('status', 'active');
  const unique = [...new Set((data ?? []).map(r => r.field_worker_name))];
  return unique.map(name => ({ field_worker_name: name }));
}

export async function getVillages(blockLeadEmail: string, fieldWorkerName: string) {
  const { data } = await supabaseAdmin
    .from('hierarchy')
    .select('village_name')
    .eq('block_lead_email', blockLeadEmail)
    .eq('field_worker_name', fieldWorkerName)
    .eq('status', 'active');
  return (data ?? []).map(r => ({ village_name: r.village_name }));
}

export const MANDATORY_COLUMNS = [
  'state', 'district', 'block', 'block_lead_email', 'field_worker_name', 'village_name',
] as const;

export const TEMPLATE_HEADERS = [...MANDATORY_COLUMNS, 'action'].join(',');

export type HierarchyRow = {
  state_name: string;
  district_name: string;
  block_name: string;
  block_lead_email: string;
  field_worker_name: string;
  village_name: string;
  action: 'upsert' | 'remove';
};

export type ValidationError = { row: number; field: string; message: string };

export type ParseResult =
  | { valid: false; errors: ValidationError[] }
  | { valid: true; errors: []; rows: HierarchyRow[] };

export function parseCSV(text: string): ParseResult {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { valid: false, errors: [{ row: 0, field: '', message: 'CSV has no data rows' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const missingColumns = MANDATORY_COLUMNS.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    return {
      valid: false,
      errors: missingColumns.map(col => ({ row: 0, field: col, message: `Missing mandatory column: ${col}` })),
    };
  }

  const idx = (col: string) => headers.indexOf(col);
  const errors: ValidationError[] = [];
  const rows: HierarchyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = lines[i].split(',').map(c => c.trim());

    for (const col of MANDATORY_COLUMNS) {
      if (!cols[idx(col)]) {
        errors.push({ row: rowNum, field: col, message: `Row ${rowNum}: ${col} is required` });
      }
    }

    const actionIdx = idx('action');
    const action = actionIdx >= 0 ? (cols[actionIdx] || 'upsert') : 'upsert';
    if (action !== 'upsert' && action !== 'remove') {
      errors.push({ row: rowNum, field: 'action', message: `Row ${rowNum}: action must be 'upsert' or 'remove', got '${action}'` });
    }

    if (errors.filter(e => e.row === rowNum).length === 0) {
      rows.push({
        state_name: cols[idx('state')],
        district_name: cols[idx('district')],
        block_name: cols[idx('block')],
        block_lead_email: cols[idx('block_lead_email')],
        field_worker_name: cols[idx('field_worker_name')],
        village_name: cols[idx('village_name')],
        action: action as 'upsert' | 'remove',
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], rows };
}

export type Preview = { adds: number; updates: number; removes: number };

export async function previewChanges(rows: HierarchyRow[]): Promise<Preview> {
  const upsertRows = rows.filter(r => r.action === 'upsert');
  const removeRows = rows.filter(r => r.action === 'remove');

  let updates = 0;
  if (upsertRows.length > 0) {
    const { data } = await supabaseAdmin
      .from('hierarchy')
      .select('state_name, district_name, block_name, field_worker_name, village_name')
      .eq('status', 'active');

    const existing = new Set(
      (data ?? []).map(r => `${r.state_name}|${r.district_name}|${r.block_name}|${r.field_worker_name}|${r.village_name}`)
    );
    updates = upsertRows.filter(r =>
      existing.has(`${r.state_name}|${r.district_name}|${r.block_name}|${r.field_worker_name}|${r.village_name}`)
    ).length;
  }

  return { adds: upsertRows.length - updates, updates, removes: removeRows.length };
}

export type UploadResult = { added: number; updated: number; removed: number };

export async function applyChanges(rows: HierarchyRow[]): Promise<UploadResult> {
  const upsertRows = rows.filter(r => r.action === 'upsert');
  const removeRows = rows.filter(r => r.action === 'remove');

  const preview = await previewChanges(rows);

  if (upsertRows.length > 0) {
    await supabaseAdmin.from('hierarchy').upsert(
      upsertRows.map(r => ({
        state_name: r.state_name,
        district_name: r.district_name,
        block_name: r.block_name,
        block_lead_email: r.block_lead_email,
        field_worker_name: r.field_worker_name,
        village_name: r.village_name,
        status: 'active',
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'state_name,district_name,block_name,field_worker_name,village_name' }
    );
  }

  if (removeRows.length > 0) {
    for (const r of removeRows) {
      await supabaseAdmin.from('hierarchy')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('state_name', r.state_name)
        .eq('district_name', r.district_name)
        .eq('block_name', r.block_name)
        .eq('field_worker_name', r.field_worker_name)
        .eq('village_name', r.village_name);
    }
  }

  return { added: preview.adds, updated: preview.updates, removed: removeRows.length };
}
