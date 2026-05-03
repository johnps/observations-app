import { redirect } from 'next/navigation';

type Props = { params: Promise<{ district: string }> };

export default async function StateLeadDistrictPage({ params }: Props) {
  const { district } = await params;
  redirect(`/district-lead/observations?district=${encodeURIComponent(district)}`);
}
