# Issue 0010 — Stale JWT causes RLS violation on sync

## Root cause

Two distinct failure modes, same symptom (`new row violates row-level security policy`):

**Mode A — stale token on startup:** After a long session gap, `getSession()` returns a cached session with an expired `access_token`. The null check passes but Supabase Storage rejects the token server-side.

**Mode B — silent session corruption mid-sync:** The Supabase JS client auto-refreshes tokens on a timer. If the refresh token has already been used (a prior session's refresh token was replayed), the client receives `refresh_token_already_used` and silently invalidates the session. `getSession()` still returns a non-null object but the `access_token` inside is now poisoned. The next upload fails RLS even though a previous upload in the same process succeeded minutes earlier.

Both modes pass the `if (!session)` null guard — the guard is necessary but not sufficient.

## Evidence from logcat

```
18:33:03  [storage] uploaded ok  93656380/0.jpg     ← fresh token, upload works
18:35:44  [storage] upload error: new row violates row-level security policy
                                                     ← same session, 2.5 min later
                                                     ← Supabase auto-refresh failed
                                                     ← with refresh_token_already_used
                                                     ← token silently poisoned
```

## What to build

**In `storage.ts`**, replace the bare `getSession()` call with a helper that:
1. Calls `getSession()`
2. If session is null → throw `'Upload failed: no authenticated session'`
3. If `session.expires_at` is within 60 seconds → call `refreshSession()`
4. If `refreshSession()` fails → throw `'Upload failed: no authenticated session'`
5. Use the (possibly refreshed) `access_token` for the upload

**In `sync.ts`**, when `syncPending()` catches an upload error that contains "no authenticated session", treat it as a permanent auth failure for this sync run — log it, stop the run (don't retry further observations), and return `{ skipped: true }`. Retrying further observations with the same poisoned session will only produce more failures.

End-to-end path:
- `mobile/lib/storage.ts` — token freshness check before every upload
- `mobile/lib/sync.ts` — detect auth failure mid-run, abort cleanly
- `mobile/__tests__/storage.test.ts` — new tests for both failure modes
- `mobile/__tests__/sync.test.ts` — new test for auth failure mid-run abort

## Demoable as

Block lead opens the app after several hours away, logs in, presses Sync Now — pending observations upload successfully. If the refresh token is also stale, the sync aborts cleanly with a log entry rather than burning through retries with repeated RLS errors.

## Acceptance criteria

- [ ] `storage.ts` checks `expires_at` and calls `refreshSession()` when token is within 60 s of expiry
- [ ] If `refreshSession()` fails, throws `'Upload failed: no authenticated session'`
- [ ] `sync.ts` detects `'no authenticated session'` errors mid-run and aborts remaining observations for that run
- [ ] Unit tests: valid non-expired token (no refresh called), expired token (refresh called, uses new token), refresh fails (throws), sync aborts on auth error
- [ ] No repeated RLS violations in logcat — at most one error per sync run, then clean abort

## Blocked by

None — can start immediately
