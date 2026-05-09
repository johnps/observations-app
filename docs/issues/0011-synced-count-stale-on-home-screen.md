# Issue 0011 — Synced count on home screen doesn't update when background sync completes

## What to build

After submitting an observation, `syncPending()` runs fire-and-forget while BlockLeadHome is already on screen. The pending count is polled, so it drops to 0 when sync completes. But the synced count is only fetched on mount or screen focus — it stays stale until the block lead navigates away and back.

Fix: include the synced count in the same poll that already watches the pending count, so both update together when sync completes in the background.

## Demoable as

Block lead submits an observation, watches the home screen — the synced count increments within a few seconds of the upload completing, without any navigation required.

## Acceptance criteria

- [ ] Synced count on home screen updates automatically after background sync completes
- [ ] Pending count and synced count update together in the same poll cycle
- [ ] No navigation required to see the updated counts

## Blocked by

None — can start immediately
