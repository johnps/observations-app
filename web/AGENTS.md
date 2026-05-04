<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Supabase client files

There are **two** Supabase client files — keep them separate:

- `lib/supabase.ts` — exports `supabase` (anon key). Safe to import in client components.
- `lib/supabase-admin.ts` — exports `supabaseAdmin` (service role key). **API routes only.** Never import in client components or any file they import.

Merging them back into one file will cause the page to crash at load time: `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix so it is `undefined` in the browser, and `createClient(url, undefined)` throws.

## Jest unit tests

Unit tests live in `web/__tests__/`. Run with `npx jest` from the `web/` directory.

The setup uses `ts-jest` with `testEnvironment: node` — suitable for testing library functions that don't need a DOM or a running server. Do **not** use this for React component tests (no jsdom configured). Use Playwright for anything that requires a browser or HTTP.

When writing unit tests for code that imports `supabaseAdmin`, mock the module:

```typescript
jest.mock('../lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({ /* chain your needed methods */ }),
  },
}));
```
