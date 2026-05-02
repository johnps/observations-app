import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side client (anon key — respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client (service role key — bypasses RLS, use only in API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
