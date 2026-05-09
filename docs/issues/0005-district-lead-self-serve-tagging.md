# Issue 0005 — District lead self-serve tagging

## What to build

Allow district leads to tag their own district's observations without involving admin.

End-to-end path:

**API (`app/api/observations/tag/route.ts`):**
- Accept an optional `district` query param on the existing `POST` handler
- When `district` is present: resolve the block lead emails for that district from the `hierarchy` table, then add an `.in('block_lead_email', emails)` filter to the observations query
- When `district` is absent: existing behaviour unchanged (global sweep, all block leads)
- Return `{ tagged, total }` as before — the caller does not need to know whether the run was scoped or global

**UI (`app/district-lead/observations/page.tsx`):**
- Add an "Auto-tag Now" button with an untagged observation count badge (e.g. "3 untagged")
- On click: `POST /api/observations/tag?district=<district>` where `<district>` is derived from the logged-in user's district (already available from the session/hierarchy query on this page)
- Show inline result: "N observations tagged" or "Nothing to tag" — no full-page reload
- Button is disabled while the request is in flight

## Demoable as

A district lead on her observations page presses "Auto-tag Now" and sees only her district's untagged observations get tagged — observations from other districts are not affected.

## Acceptance criteria

- [ ] `POST /api/observations/tag?district=Latehar` only tags observations whose `block_lead_email` belongs to a block lead in the Latehar district hierarchy
- [ ] `POST /api/observations/tag` (no param) still tags all untagged observations globally — admin behaviour unchanged
- [ ] If no block leads exist for the given district, the route returns `{ tagged: 0, total: 0 }` without calling Claude
- [ ] District lead observations page shows untagged count and "Auto-tag Now" button
- [ ] Button is disabled during the request; result message shown inline after completion
- [ ] Unit tests cover: scoped run filters by district block leads; global run (no param) is unaffected; empty district returns early without Claude call

## Blocked by

None — can start immediately
