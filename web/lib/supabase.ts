import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side client (anon key — respects RLS, safe to import in client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
