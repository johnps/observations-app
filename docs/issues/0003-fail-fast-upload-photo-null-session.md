# Issue 0003 — Fail-fast in `uploadPhoto` when session is null

## What to build

Remove the `?? SUPABASE_ANON_KEY` fallback in `storage.ts`. When `getSession()` returns a null session (e.g. after a `refresh_token_already_used` error), `uploadPhoto` must throw a clear auth error immediately rather than attempting an upload with the anon key that will always fail the storage RLS policy (`authenticated` role required).

End-to-end path:
- `lib/storage.ts` — remove anon key fallback on line 25; throw `new Error('Upload failed: no authenticated session')` if session is null
- `lib/__tests__/storage.test.ts` — add test: `uploadPhoto` throws when `getSession` returns null session

## Demoable as

A block lead whose refresh token has expired sees the observation remain in the pending queue (retryable) rather than generating a `new row violates row-level security policy` error in the log.

## Acceptance criteria

- [ ] `uploadPhoto` throws immediately (before fetching the file blob or making an upload request) when `getSession()` returns a null session
- [ ] The thrown error message is `'Upload failed: no authenticated session'`
- [ ] The anon key fallback (`?? SUPABASE_ANON_KEY`) is removed from `storage.ts`
- [ ] Unit test: `uploadPhoto` rejects with the auth error message when `getSession` returns `{ data: { session: null } }`
- [ ] Existing `uploadPhoto` success and non-auth failure tests still pass

## Blocked by

None — can start immediately
