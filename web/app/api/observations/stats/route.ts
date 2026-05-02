import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

type Dimension = 'block_lead' | 'field_worker' | 'village' | 'tag';

function periodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  if (period === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { from, to };
  }
  if (period === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { from, to: end };
  }
  if (period === 'last_3_months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    return { from, to };
  }
  if (period === 'last_6_months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    return { from, to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return { from, to };
}

export async function GET(req: NextRequest) {
  const dimension = (req.nextUrl.searchParams.get('dimension') ?? 'block_lead') as Dimension;
  const period = req.nextUrl.searchParams.get('period') ?? 'this_month';

  const { from, to } = periodRange(period);

  const { data: obs, error } = await supabaseAdmin
    .from('observations')
    .select('block_lead_email, field_worker_name, village_name, tags')
    .gte('submitted_at', from)
    .lt('submitted_at', to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};

  for (const row of obs ?? []) {
    let keys: string[] = [];
    if (dimension === 'block_lead') keys = [row.block_lead_email];
    else if (dimension === 'field_worker') keys = [row.field_worker_name];
    else if (dimension === 'village') keys = [row.village_name];
    else if (dimension === 'tag') keys = row.tags?.length ? row.tags : ['(untagged)'];

    for (const k of keys) {
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }

  // For block_lead dimension, surface users with role=block_lead even if count is zero
  if (dimension === 'block_lead') {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('role', 'block_lead');
    for (const u of users ?? []) {
      if (!(u.email in counts)) counts[u.email] = 0;
    }
  }

  const stats = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ stats });
}
