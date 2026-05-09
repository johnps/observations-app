import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  const district = req.nextUrl.searchParams.get('district');

  const { data: tagDefs, error: tagErr } = await supabaseAdmin
    .from('tags')
    .select('name, description')
    .eq('retired', false);

  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });
  if (!tagDefs?.length) return NextResponse.json({ tagged: 0, total: 0 });

  let blockLeadEmails: string[] | null = null;
  if (district) {
    const { data: hier, error: hierErr } = await supabaseAdmin
      .from('hierarchy')
      .select('block_lead_email')
      .eq('district_name', district)
      .eq('status', 'active');
    if (hierErr) return NextResponse.json({ error: hierErr.message }, { status: 500 });
    blockLeadEmails = [...new Set((hier ?? []).map((h: { block_lead_email: string }) => h.block_lead_email))];
    if (!blockLeadEmails.length) return NextResponse.json({ tagged: 0, total: 0 });
    console.log(`[tagging] district=${district} resolved ${blockLeadEmails.length} block leads`);
  }

  let obsQuery = supabaseAdmin
    .from('observations')
    .select('id, text');
  if (blockLeadEmails) obsQuery = (obsQuery as any).in('block_lead_email', blockLeadEmails);
  const { data: obs, error: obsErr } = await (obsQuery as any)
    .or('tags.eq.{},tags.is.null')
    .limit(BATCH_SIZE);

  if (obsErr) return NextResponse.json({ error: obsErr.message }, { status: 500 });
  if (!obs?.length) return NextResponse.json({ tagged: 0, total: 0 });

  const tagList = tagDefs.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const obsList = (obs as Array<{ id: string; text: string }>).map((o, i) => `${i + 1}. "${o.text}"`).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a tagging assistant for a rural livelihood programme in India.
For each observation below, assign 0 to 3 tags from the available list.
Return ONLY a JSON array of arrays — one sub-array per observation, in the same order.
Example for 3 observations: [["kitchen_garden"], ["livestock", "nutrition"], []]

Available tags:
${tagList}

Observations:
${obsList}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
  let assignments: string[][] = [];
  try {
    // Extract JSON array even if Claude adds surrounding text
    const match = raw.match(/\[[\s\S]*\]/);
    assignments = JSON.parse(match ? match[0] : '[]');
  } catch {
    assignments = obs.map(() => []);
  }

  const validNames = new Set(tagDefs.map(t => t.name));
  let tagged = 0;

  for (let i = 0; i < obs.length; i++) {
    const raw = assignments[i] ?? [];
    const tags = raw.filter(t => validNames.has(t));
    const { error: updateErr } = await supabaseAdmin.from('observations').update({ tags }).eq('id', obs[i].id);
    if (updateErr) { console.error('[tagging] update failed', obs[i].id, updateErr.message); continue; }
    if (tags.length > 0) tagged++;
  }

  return NextResponse.json({ tagged, total: obs.length });
}
