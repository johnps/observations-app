import { SignOutButton } from '@/components/SignOutButton';

export default function BlockLeadWeb() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold text-gray-800">Livelihood Monitor</h1>
      <p className="text-gray-500 text-sm">Please use the Android app to log observations.</p>
      <SignOutButton />
    </main>
  );
}
