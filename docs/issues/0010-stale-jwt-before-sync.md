# Issue 0010 — Stale JWT causes RLS violation on sync after long session gap

## What to build

After a long session gap (hours between uses), `supabase.auth.getSession()` can return a cached session object whose `access_token` has expired. The null check in `storage.ts` and `sync.ts` passes — the session is non-null — but Supabase Storage rejects the expired token with "new row violates row-level security policy". This causes all photo uploads to fail until the app is restarted.

The fix: before using the token in `storage.ts`, check whether the access token is expired and force a refresh if so. Use `supabase.auth.getSession()` — the Supabase JS client automatically refreshes if needed when called, but only if the refresh token is valid and the client has been idle. To be safe, explicitly call `supabase.auth.refreshSession()` if `session.expires_at` is in the past or within the next 60 seconds.

End-to-end path:
- `mobile/lib/storage.ts` — after `getSession()`, check `session.expires_at` and call `refreshSession()` if the token is stale. Use the refreshed session's `access_token` for the upload.

## Evidence from logcat

```
18:23:35  [sync] skipped — no session         ← getSession() returned null
18:23:41  [storage] upload error: new row violates row-level security policy
18:23:41  [sync] obs error: Upload failed: new row violates row-level security policy
18:24:13  [storage] upload error: new row violates row-level security policy  ← retry also fails
```

Six seconds after `getSession()` returned null, a second sync trigger fired, `getSession()` now returned a cached (expired) session, null check passed, expired token sent to Storage REST API — rejected by RLS.

## Demoable as

Block lead opens the app after several hours away, logs in, presses Sync Now — pending observations upload successfully without an RLS error in logcat.

## Acceptance criteria

- [ ] `storage.ts` checks `session.expires_at` after `getSession()`
- [ ] If the token is expired or expiring within 60 seconds, `refreshSession()` is called and the refreshed token is used
- [ ] If `refreshSession()` fails (e.g. refresh token also expired), throws `'Upload failed: no authenticated session'` — same path as null session
- [ ] Unit tests cover: valid non-expired token (no refresh), expired token (refresh called, upload uses new token), refresh fails (throws)
- [ ] RLS violation no longer appears in logcat after a long session gap

## Blocked by

None — can start immediately
