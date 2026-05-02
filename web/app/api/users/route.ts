import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

const GEOGRAPHY_REQUIRED: Record<string, string> = {
  district_lead: 'district_name',
  block_lead: 'block_name',
  state_lead: 'state_name',
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, state_name, district_name, block_name')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, role, state_name, district_name, block_name } = body;

  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }

  const requiredField = GEOGRAPHY_REQUIRED[role];
  if (requiredField && !body[requiredField]) {
    return NextResponse.json(
      { error: `${requiredField} is required for role ${role}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ email, role, state_name, district_name, block_name }, { onConflict: 'email' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
