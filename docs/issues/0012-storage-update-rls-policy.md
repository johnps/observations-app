# Issue 0012 — Storage RLS blocks re-upload of already-uploaded photos

## Root cause

The `observation-photos` bucket has an INSERT policy for `authenticated` role but no UPDATE policy. When `syncPending()` uploads a photo with `x-upsert: true`, Supabase Storage attempts an UPDATE on paths that already exist. The UPDATE is rejected by RLS, producing `new row violates row-level security policy` on every subsequent sync attempt for that observation — even across sign-outs and app restarts — because the file is already there.

This creates an observation that can never be synced: the photo upload always fails, the retry counter increments, and eventually the observation moves to Failed Observations. Re-queuing from Failed Observations doesn't help — the upload fails on the first retry for the same reason.

## What to build

Two complementary fixes:

**Fix 1 — Add UPDATE RLS policy to the storage bucket (Supabase dashboard).**
The `authenticated` role needs an UPDATE policy on `observation-photos`. The simplest safe policy: allow UPDATE for any authenticated user (matching the INSERT policy). This unblocks re-uploads for legitimate retries.

**Fix 2 — Detect "already uploaded" in `storage.ts` and treat a 200/409 from an existing path as success.**
Before re-uploading, check if the upload response indicates the file already exists at that path. If the photo is already in storage and the observation record is not yet synced locally, the upload step can be skipped — mark the photo as uploaded and proceed to writing the observation record to the database. This handles the case where a previous sync uploaded the photo but crashed before writing the DB record.

Both fixes are needed: Fix 1 is the defensive policy change; Fix 2 makes the sync logic resilient to partial-completion.

## Demoable as

Block lead re-queues a photo observation from Failed Observations — it syncs successfully rather than failing again with an RLS error.

## Acceptance criteria

- [ ] Supabase `observation-photos` bucket has an UPDATE policy for `authenticated` role
- [ ] `storage.ts` handles a 409 Conflict (or equivalent "already exists") response as a successful upload
- [ ] An observation whose photo is already in storage but not yet DB-synced completes successfully on next sync attempt
- [ ] No `new row violates row-level security policy` errors in logcat for re-sync attempts

## Blocked by

None — can start immediately

## Status

Implemented
