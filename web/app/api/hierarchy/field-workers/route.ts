import { getFieldWorkers } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('block_lead_email');
  if (!email) return NextResponse.json({ error: 'block_lead_email required' }, { status: 400 });
  const field_workers = await getFieldWorkers(email);
  return NextResponse.json({ field_workers });
}
