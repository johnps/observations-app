# Issue 0001 — Capture permanently-failed observations and surface count on home screen

## What to build

When `syncPending` permanently discards an observation (either a 400 response from the API, or MAX_RETRIES exhausted), store the observation in a new `failed_observations` SQLite table instead of silently calling `markSynced`. Show a red count badge on the home screen so the block lead knows an observation needs attention.

End-to-end path:
- `types/observation.ts` — add `FailedObservation` interface
- `db.ts` — add `failed_observations` table in `initDB()`, plus `markFailed(id, reason)` and `getFailedObservations()`
- `sync.ts` — replace both `markSynced` calls at discard points with `markFailed`:
  - Line 84: 400 response (permanent rejection)
  - Lines 90 and 99: MAX_RETRIES exhausted
- `App.tsx` — add `failedCount` state with 3s poll on focus (same pattern as `pendingCount`), show red "Failed" count badge on home screen, add `FailedObservations` route to `RootStackParamList` navigating to an empty-state placeholder

## Demoable as

An observation that hits MAX_RETRIES (or gets a 400) no longer silently disappears — the home screen shows a non-zero red "Failed" badge count.

## Acceptance criteria

- [ ] `failed_observations` table exists after `initDB()` with columns: `id`, `payload`, `reason`, `failed_at`
- [ ] `markFailed(id, reason)` inserts into `failed_observations` and sets `synced = 1` on the `pending_observations` row (removes it from the pending queue)
- [ ] `getFailedObservations()` returns all rows from `failed_observations`
- [ ] `sync.ts` calls `markFailed` (not `markSynced`) at both permanent-discard sites
- [ ] Home screen shows a red badge with the failed count when `failedCount > 0`
- [ ] "Failed Observations" button is present on home screen and navigates to a route (empty state is acceptable in this slice)
- [ ] Unit tests cover: `markFailed` stores the observation, `sync.ts` calls `markFailed` on 400 and on MAX_RETRIES exhaustion

## Blocked by

None — can start immediately
