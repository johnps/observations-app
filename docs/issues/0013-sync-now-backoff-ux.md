# Issue 0013 — Sync Now silently skips when in backoff

## What to build

`syncPending()` enforces a backoff window via `_nextSyncAfter`. When the block lead presses Sync Now during this window, the call returns immediately with `{ skipped: true }` and the UI shows nothing — no spinner, no message, no indication that sync was skipped. The user assumes the button is broken or the sync is stuck.

Fix: when Sync Now is pressed manually, either:

**Option A — bypass backoff on manual press.** A manual press signals intent. Ignore `_nextSyncAfter` and run the sync immediately. Background auto-retries still respect the backoff. This is the simpler fix and matches user expectation: pressing Sync Now should always attempt a sync.

**Option B — show a "cooling down" message.** Keep the backoff for manual presses too, but display "Sync cooling down — try again in Xs" so the user knows why nothing happened.

Recommendation: **Option A**. Backoff exists to prevent hammering on background retries. A deliberate manual press is different — the user has decided to try now. Ignoring backoff on manual press is correct behavior.

Implementation:
- `syncPending()` accepts an `options?: { force?: boolean }` parameter
- When `force: true`, skip the `_nextSyncAfter` check
- `BlockLeadHome` passes `{ force: true }` when the Sync Now button is pressed
- Background calls (post-submit fire-and-forget) pass no options, preserving existing backoff behavior

## Demoable as

Block lead presses Sync Now — the spinner appears immediately every time, even if a previous sync just ran. No silent skips.

## Acceptance criteria

- [ ] Sync Now button always triggers a visible sync attempt (spinner + result)
- [ ] `syncPending({ force: true })` bypasses `_nextSyncAfter` and runs immediately
- [ ] Background fire-and-forget calls still respect the backoff window
- [ ] Unit tests: `force: true` bypasses backoff; call without `force` still skips during backoff

## Blocked by

None — can start immediately

## Status

Implemented
