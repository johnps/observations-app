import { getGeographies } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') as 'block' | 'district' | 'state' | null;
  if (!type || !['block', 'district', 'state'].includes(type)) {
    return NextResponse.json({ error: 'type must be block, district, or state' }, { status: 400 });
  }
  const options = await getGeographies(type);
  return NextResponse.json({ options });
}
