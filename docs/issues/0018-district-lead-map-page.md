# Issue 0018 — District lead map page with GPS pins and filters

## What to build

A new page at `/district-lead/map` that plots observation GPS pins on an OpenStreetMap base layer for the district lead's district. The page uses the react-leaflet installation and `useFilterState` hook from Issue 0017, and mounts the `TopNav` from Issue 0015.

**Role guard:** Same pattern as the observations page — `getSessionRole()` on mount; redirect to `/` if role is not `district_lead`; district name derived from session (ADR 0005, never from the URL).

**Data:** Fetches observations via `GET /api/observations?district=<name>`. Only observations where `gps_captured === true` are plotted as pins. Observations without GPS are silently excluded — no placeholder pins.

**Map:** `MapContainer` with OpenStreetMap `TileLayer`. Default center = mean lat/lng of all GPS-captured observations for the district (computed client-side after fetch). Default zoom = 13 (village level). Each GPS observation is a `CircleMarker`. No popup on click — the map is a spatial coverage overview, not a record detail view.

**Filters:** Block, field worker, village, tag — via `useFilterState`. Pins update instantly as filters change. The filter UI matches the observations page in layout and behaviour.

**Empty state:** If no observations match the active filters (or no GPS observations exist at all), show a message over the map area: "No GPS observations match the current filters."

**Navigation:** `TopNav` is mounted. The "Map" link in the nav bar is the entry point from the observations page.

**SSR:** The map component must be loaded via `next/dynamic` with `ssr: false` (established in Issue 0017). Do not render the `MapContainer` server-side.

**CSS:** `leaflet/dist/leaflet.css` already imported via Issue 0017's layout change.

## Demoable as

District lead clicks "Map" in the nav bar and sees a full-screen OpenStreetMap centred on their district with GPS pins for their observations; using the filter dropdowns removes pins in real time.

## Acceptance criteria

- [ ] `/district-lead/map` redirects to `/` if session role is not `district_lead`
- [ ] District is derived from session, not the URL
- [ ] Map renders with OpenStreetMap tiles at zoom 13, centred on the district's mean GPS coordinates
- [ ] Each observation with `gps_captured === true` appears as a pin on the map
- [ ] Observations with `gps_captured === false` or `null` do not appear
- [ ] Filter controls (block, field worker, village, tag) update pins in real time
- [ ] Empty-state message shown when no pins match the active filters
- [ ] `TopNav` is mounted and shows correct district lead links
- [ ] `next build` succeeds (no SSR / hydration errors from the map component)

## Blocked by

- Issue 0015 — TopNav must exist to mount on this page and for the "Map" nav link
- Issue 0017 — react-leaflet must be installed and `useFilterState` must be extracted before building this page

## Status

Implemented
