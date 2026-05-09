# Issue 0004 — Guard `syncPending` against unauthenticated state

## What to build

Add a session check at the top of `syncPending()` in `sync.ts`. If `getSession()` returns a null session, return `{ skipped: true, synced: 0, failed: 0, errors: [] }` immediately with a `[sync] skipped — no session` log. This prevents the sync loop from consuming retry budget and generating RLS-violation log noise when the user is not authenticated.

End-to-end path:
- `lib/sync.ts` — import `supabase` from `./supabase`; add session check after the existing `_isConnected` guard; return `skipped` result if session is null
- `lib/__tests__/sync.test.ts` — add test: `syncPending` returns `{ skipped: true }` when session is null, and `getPendingObservations` is never called

## Demoable as

Logcat shows `[sync] skipped — no session` on startup when the refresh token has expired, instead of a chain of `new row violates row-level security policy` errors.

## Acceptance criteria

- [ ] `syncPending` calls `supabase.auth.getSession()` before entering the observation loop
- [ ] Returns `{ skipped: true, synced: 0, failed: 0, errors: [] }` if session is null
- [ ] Logs `[sync] skipped — no session` when skipping for this reason
- [ ] `getPendingObservations` is never called when session is null
- [ ] Unit test: `syncPending` returns `skipped: true` and does not call `getPendingObservations` when `getSession` returns null session
- [ ] Existing sync tests still pass

## Blocked by

None — can start immediately
