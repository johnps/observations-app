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
getSessionRole(): Promise<{
  role: string | null;
  district_name: string | null;
  fullName: string | null;
  email: string | null;
}>
```

It calls `supabase.auth.getSession()` (local cache — no round-trip) then fetches `/api/users/role`. All failure paths return nulls — callers treat null role as unauthenticated and redirect to `/`. `fullName` and `email` come from `session.user.user_metadata.full_name` and `session.user.email`; they are available even if the role API call fails.

Use this in client pages that need to verify role on mount:

```typescript
useEffect(() => {
  getSessionRole().then(({ role, district_name, fullName, email }) => {
    if (role !== 'district_lead') { router.replace('/'); return; }
    setSessionDistrict(district_name);
    setNavFullName(fullName);
    setNavEmail(email);
  });
}, [router]);
```

Pass `fullName` and `email` to `<TopNav>` (see TopNav section below).

**District lead page:** derives its `districtFilter` from the session, not the URL. The URL never carries a district name for district leads — it is a mutable string that would break if an admin renames the district.

**State lead page:** verifies role on mount; redirects to `/` if role is not `state_lead`; renders `null` until auth is confirmed.

## TopNav component

`web/components/TopNav.tsx` renders the persistent nav bar on every authenticated web page. Props:

```typescript
<TopNav role="district_lead" fullName={navFullName} email={navEmail} />
```

Pass the role as a **hard-coded string literal** (e.g. `"district_lead"`), not as the dynamic value from `getSessionRole`. The role determines which links render; since the page's own role guard has already verified the role is correct, hard-coding avoids a flash of an empty nav bar before the async check resolves.

Role-to-links mapping lives in `ROLE_LINKS` inside `TopNav.tsx`. Sign-out is always rendered.

## Filter state — `useFilterState` and `filterObservations`

`web/hooks/useFilterState.ts` — React hook that wraps filter state for observation lists. Takes `observations: Observation[]`, returns all 7 filter values + setters + `filteredObservations`, `opts` (unique option arrays), `hasFilters`, and `clearFilters`.

`web/lib/filterObservations.ts` — pure predicate function extracted from the hook. No React imports; testable in the Jest `node` environment without jsdom.

On the map page, pass **only GPS-captured observations** into `useFilterState` (pre-filtered to `gps_captured === true`). This means filter dropdowns show only values from observations that have a pin on the map, which is intentional.

## Playwright tests for auth-gated pages

Playwright tests run with a fresh browser context — no stored Supabase session. Pages that require `getSessionRole()` to resolve before showing data (district lead observations, district lead map) will redirect to `/` in the test context.

**Workaround:** navigate with `?from=state-lead&district=TestDistrict`. Both the observations page and the map page treat this param as the state-lead drill-down path: they skip the session auth check and use the URL district directly. This gives full access to the page UI in tests without needing a real session. Seed the hierarchy for `TestDistrict` in `beforeAll` when using this pattern.

## State lead drill-down navigation

`/state-lead/district/[district]/page.tsx` redirects to `/district-lead/observations?district=<name>&from=state-lead`.

The `from=state-lead` param tells the district observations page and the district map page to use the URL's `district` param (the state lead's explicit choice) and skip the session role check. Without `from=state-lead`, both pages ignore the URL district and derive it from the session instead.

## Tagging endpoint — district scoping

`POST /api/observations/tag` accepts an optional `district` query param:

- **With `?district=<name>`** — scoped run: resolves block lead emails for that district from the hierarchy table, then filters observations to those block leads only. Used by district leads.
- **Without `district`** — global run: processes all untagged observations across all districts. Used by admin.

Both runs skip already-tagged observations (`tags = '{}' OR tags IS NULL` filter). Neither makes a Claude API call if there is nothing to tag.
