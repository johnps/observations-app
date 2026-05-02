import { getVillages } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('block_lead_email');
  const worker = req.nextUrl.searchParams.get('field_worker_name');
  if (!email || !worker) {
    return NextResponse.json({ error: 'block_lead_email and field_worker_name required' }, { status: 400 });
  }
  const villages = await getVillages(email, worker);
  return NextResponse.json({ villages });
}
