import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

function periodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (period === 'last_month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    };
  }
  if (period === 'last_3_months') {
    return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(), to };
  }
  if (period === 'last_6_months') {
    return { from: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString(), to };
  }
  // default: this_month
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
}

export async function GET(req: NextRequest) {
  const district = req.nextUrl.searchParams.get('district');
  const period = req.nextUrl.searchParams.get('period') ?? 'this_month';
  const { from, to } = periodRange(period);

  // Fetch observations in period
  const { data: obs, error: obsErr } = await supabaseAdmin
    .from('observations')
    .select('block_lead_email')
    .gte('submitted_at', from)
    .lt('submitted_at', to);

  if (obsErr) return NextResponse.json({ error: obsErr.message }, { status: 500 });

  // Count by block_lead_email
  const blCounts: Record<string, number> = {};
  for (const row of obs ?? []) {
    blCounts[row.block_lead_email] = (blCounts[row.block_lead_email] ?? 0) + 1;
  }

  if (district) {
    // Drill-down: return block lead counts within this district
    const { data: hier } = await supabaseAdmin
      .from('hierarchy')
      .select('block_lead_email')
      .eq('district', district)
      .eq('deleted', false);

    const blockLeads = [...new Set((hier ?? []).map(h => h.block_lead_email))];
    const stats = blockLeads
      .map(bl => ({ name: bl, count: blCounts[bl] ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ stats });
  }

  // Top-level: return district counts
  const { data: hier } = await supabaseAdmin
    .from('hierarchy')
    .select('district, block_lead_email')
    .eq('deleted', false);

  const districtCounts: Record<string, number> = {};
  for (const row of hier ?? []) {
    if (!(row.district in districtCounts)) districtCounts[row.district] = 0;
    districtCounts[row.district] += blCounts[row.block_lead_email] ?? 0;
  }

  const stats = Object.entries(districtCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ stats });
}
