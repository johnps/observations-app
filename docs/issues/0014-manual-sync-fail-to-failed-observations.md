# Issue 0014 — Failed manual Sync Now should move observation to Failed Observations immediately

## What to build

When a background auto-retry fails, keeping the observation in pending with a "will retry automatically" message is correct — the failure may be transient and the user isn't watching.

When the block lead manually presses Sync Now and it fails, the observation should move to Failed Observations immediately, not remain in pending. The user has explicitly triggered a sync, it failed, and they need actionable feedback. "Will retry automatically" after a deliberate manual press is misleading — the user has no visibility into when or whether the retry will succeed, and if the failure is structural (stale JWT, RLS violation, no connectivity) no number of retries will help.

Failed Observations already has dismiss and re-queue actions. Re-queue is the equivalent of "try again" — if the failure was transient, the block lead can re-queue and it will retry in the background.

Implementation:
- `syncPending()` returns a result that distinguishes manual-press failures from background-retry failures
- Alternatively: `syncPending({ force: true })` (from Issue 0013) treats any upload failure as terminal for that observation on this run — marks it failed rather than incrementing retry count
- Background calls still increment retry count and only move to failed after `MAX_RETRIES`
- `BlockLeadHome` handles a failed forced sync by refreshing the failed/pending counts

## Demoable as

Block lead presses Sync Now, the upload fails — the observation immediately appears in Failed Observations rather than staying in pending with "will retry automatically."

## Acceptance criteria

- [ ] When Sync Now is pressed manually and an observation fails to upload, it moves to Failed Observations on that sync run
- [ ] Background auto-retries still use the existing MAX_RETRIES threshold before failing
- [ ] Failed Observations count updates on the home screen after a manual sync failure
- [ ] "Will retry automatically" message is not shown after a manual Sync Now failure
- [ ] Unit tests: forced sync failure → observation marked failed; background sync failure → observation stays pending until MAX_RETRIES

## Blocked by

Issue 0013 — Sync Now backoff UX (the `force` option distinguishes manual from background)

## Status

Implemented
