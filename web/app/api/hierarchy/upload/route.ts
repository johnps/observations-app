import { parseCSV, applyChanges } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const text = await file.text();
  const parsed = parseCSV(text);

  if (!parsed.valid) {
    return NextResponse.json({ error: 'Invalid CSV', errors: parsed.errors }, { status: 400 });
  }

  const result = await applyChanges(parsed.rows);
  return NextResponse.json(result);
}
