import { parseCSV, previewChanges } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const text = await file.text();
  const parsed = parseCSV(text);

  if (!parsed.valid) {
    return NextResponse.json({ valid: false, errors: parsed.errors, preview: null });
  }

  const preview = await previewChanges(parsed.rows);
  return NextResponse.json({ valid: true, errors: [], preview });
}
