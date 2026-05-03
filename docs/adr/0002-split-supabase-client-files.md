# ADR 0002 — Split Supabase client into two files

## Status
Accepted

## Context

The original `lib/supabase.ts` exported both `supabase` (anon key) and `supabaseAdmin` (service role key) from a single file. Client components such as `app/page.tsx` import `supabase` from this file. When Next.js bundles a client component, it executes the entire imported module in the browser — including the `createClient(url, supabaseServiceKey)` call where `supabaseServiceKey` is `undefined` (the `SUPABASE_SERVICE_ROLE_KEY` env var has no `NEXT_PUBLIC_` prefix and is therefore absent on the client). Recent versions of `@supabase/supabase-js` throw on a missing key, crashing the page at load time.

## Decision

Split into two files:
- `lib/supabase.ts` — anon key only, safe for client components
- `lib/supabase-admin.ts` — service role key only, imported exclusively by API routes and server-side lib files

## Consequences

- API routes must import from `lib/supabase-admin.ts`, not `lib/supabase.ts`
- Client components must import from `lib/supabase.ts` only
- `lib/hierarchy.ts` (used only by API routes) imports from `lib/supabase-admin.ts`
- Do not merge these files back — the crash is silent until the page is opened in a browser
