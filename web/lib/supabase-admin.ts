import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side only — bypasses RLS. Import only in API routes, never in client components.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
