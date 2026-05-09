# Issue 0017 — Install react-leaflet and extract useFilterState

## What to build

Two foundational changes that Issue 0018 (map page) depends on. Neither is user-visible on its own beyond proving nothing regressed.

### 1. Install and verify react-leaflet

Install the exact versions required for React 19 + Next.js 16 compatibility:

```
react-leaflet@5.0.0
leaflet@^1.9.4
@types/leaflet (dev)
```

Verify the SSR dynamic-import pattern compiles and `next build` succeeds without hydration warnings. The pattern requires:
- A thin wrapper component that uses `next/dynamic` with `ssr: false`
- The actual map content in a separate `'use client'` component
- `leaflet/dist/leaflet.css` imported in the layout or the wrapper (never in a server component)
- The webpack default marker icon fix applied in the map content component:
  ```ts
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
  ```
  This fix is required because Next.js webpack cannot resolve Leaflet's default marker icon URLs at build time.

Do not render a map on any existing page — just verify the install and pattern via build + a throwaway test component if needed.

### 2. Extract useFilterState from the observations page

The district lead observations page and the upcoming map page both need identical filter controls (block, field worker, village, tag, GPS status). The filter state logic is currently embedded in the observations page. Extract it into a `useFilterState(observations: Observation[])` hook that returns:
- Active filter values and their setters
- `filteredObservations: Observation[]` — the derived, filtered array

The pure filter logic (the predicate that applies all active filters to a single observation) must be extractable as a standalone function so it can be tested with the existing Jest `node` environment — no jsdom required.

Refactor the observations page to use the hook. Behaviour must be identical — this is a pure refactor.

**Tests (Jest, node environment):**
- Single filter (e.g. block) reduces to only matching observations
- Single filter by GPS status `captured` returns only `gps_captured === true` observations
- Multiple active filters are AND-combined (both must match)
- Clearing a filter returns all observations

## Demoable as

District lead observations page filters work identically after the refactor; `next build` exits successfully with react-leaflet installed and no hydration errors in the build output.

## Acceptance criteria

- [ ] `npm install` succeeds with react-leaflet 5.0.0, leaflet@^1.9.4, @types/leaflet
- [ ] `next build` exits with no errors and no hydration warnings related to leaflet
- [ ] `leaflet/dist/leaflet.css` is imported in the correct location (not a server component)
- [ ] Webpack marker icon fix is present in the map content component skeleton
- [ ] `useFilterState` hook exists and is used by the observations page
- [ ] Observations page filter behaviour is unchanged (Playwright: existing district-lead-observations.spec.ts passes)
- [ ] Pure filter function is tested: single filter, GPS filter, AND-combination, reset
- [ ] Jest unit tests pass: `npx jest` from `web/` directory

## Blocked by

None — can start immediately

## Status

Implemented
