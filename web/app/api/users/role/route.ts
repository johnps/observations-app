import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role, district_name')
    .eq('email', email)
    .single();

  if (error || !data) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ role: data.role, district_name: data.district_name ?? null });
}
