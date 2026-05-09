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

When the mock factory references a `jest.fn()` defined in the outer scope, use `var` (not `const`/`let`) so the variable is hoisted before the factory evaluates:

```typescript
var mockCreate: jest.Mock;
jest.mock('@anthropic-ai/sdk', () => {
  mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
});
```

## Session-based role verification — `getSessionRole`

`web/lib/getSessionRole.ts` exports a single async function:

```typescript
getSessionRole(): Promise<{ role: string | null; district_name: string | null }>
```

It calls `supabase.auth.getSession()` then fetches `/api/users/role`. All failure paths (no session, non-ok response, fetch throws) return `{ role: null, district_name: null }` — callers treat null role as unauthenticated and redirect to `/`.

Use this in client pages that need to verify role on mount:

```typescript
useEffect(() => {
  getSessionRole().then(({ role, district_name }) => {
    if (role !== 'district_lead') { router.replace('/'); return; }
    setSessionDistrict(district_name);
  });
}, [router]);
```

**District lead page:** derives its `districtFilter` from the session, not the URL. The URL never carries a district name for district leads — it is a mutable string that would break if an admin renames the district.

**State lead page:** verifies role on mount; redirects to `/` if role is not `state_lead`; renders `null` until auth is confirmed.

## State lead drill-down navigation

`/state-lead/district/[district]/page.tsx` redirects to `/district-lead/observations?district=<name>&from=state-lead`.

The `from=state-lead` param tells the district observations page to use the URL's `district` param (the state lead's explicit choice) and to render the "← State Overview" back link. Without `from=state-lead`, the page ignores the URL district and derives it from the session instead.

## Tagging endpoint — district scoping

`POST /api/observations/tag` accepts an optional `district` query param:

- **With `?district=<name>`** — scoped run: resolves block lead emails for that district from the hierarchy table, then filters observations to those block leads only. Used by district leads.
- **Without `district`** — global run: processes all untagged observations across all districts. Used by admin.

Both runs skip already-tagged observations (`tags = '{}' OR tags IS NULL` filter). Neither makes a Claude API call if there is nothing to tag.
