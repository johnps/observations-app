import { TEMPLATE_HEADERS } from '@/lib/hierarchy';
import { NextResponse } from 'next/server';

export async function GET() {
  const csv = `${TEMPLATE_HEADERS}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="hierarchy-template.csv"',
    },
  });
}
