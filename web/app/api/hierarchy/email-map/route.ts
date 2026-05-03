import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

// Returns { [block_lead_email]: { district_name, block_name } } for enriching observation rows
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('hierarchy')
    .select('block_lead_email, district_name, block_name')
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, { district_name: string; block_name: string }> = {};
  for (const r of data ?? []) {
    if (!map[r.block_lead_email]) {
      map[r.block_lead_email] = { district_name: r.district_name, block_name: r.block_name };
    }
  }

  return NextResponse.json({ map });
}
