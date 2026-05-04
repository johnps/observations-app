import { validateHierarchyCSV } from '@/lib/hierarchy';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const text = await file.text();
  const result = await validateHierarchyCSV(text);
  return NextResponse.json(result);
}
