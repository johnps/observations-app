import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, text, field_worker_name, village_name, block_lead_email, gps_lat, gps_lng, photo_urls, submitted_at } = body;

  if (!id || !text || !field_worker_name || !village_name || !block_lead_email || !submitted_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const gps_captured = !!(gps_lat && gps_lng);

  const { data, error } = await supabaseAdmin
    .from('observations')
    .upsert({
      id,
      text,
      field_worker_name,
      village_name,
      block_lead_email,
      gps_lat: gps_lat ?? null,
      gps_lng: gps_lng ?? null,
      gps_captured,
      photo_urls: photo_urls ?? [],
      submitted_at,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  const block_lead_email = req.nextUrl.searchParams.get('block_lead_email');

  let query = supabaseAdmin
    .from('observations')
    .select('id, text, field_worker_name, village_name, block_lead_email, gps_captured, submitted_at')
    .order('submitted_at', { ascending: false });

  if (block_lead_email) query = query.eq('block_lead_email', block_lead_email);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ observations: data });
}
