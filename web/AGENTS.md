<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Supabase client files

There are **two** Supabase client files — keep them separate:

- `lib/supabase.ts` — exports `supabase` (anon key). Safe to import in client components.
- `lib/supabase-admin.ts` — exports `supabaseAdmin` (service role key). **API routes only.** Never import in client components or any file they import.

Merging them back into one file will cause the page to crash at load time: `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix so it is `undefined` in the browser, and `createClient(url, undefined)` throws.
