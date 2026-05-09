# Issue 0002 — Failed Observations screen: review, dismiss, and re-queue

## What to build

A new `FailedObservations` screen that lists each permanently-failed observation with its full content, failure reason, and two actions: Dismiss (removes the record) and Re-queue (re-adds it to the pending sync queue with a reset retry counter).

End-to-end path:
- `db.ts` — add `clearFailed(id)` and `requeueFailed(id)`:
  - `clearFailed`: deletes the row from `failed_observations`
  - `requeueFailed`: calls `queueObservation` with the stored payload (which uses `INSERT OR REPLACE`, resetting `synced = 0` and `retry_count = 0`), then calls `clearFailed`
- `screens/FailedObservations.tsx` — new screen: FlatList of failed observations showing text, field worker, village, submitted_at, failure reason, "Re-queue" and "Dismiss" buttons per row
- `App.tsx` — wire the `FailedObservations` route to the new screen; after dismiss or re-queue, refresh `failedCount`

**Note on re-queue for 400 errors:** Observations that failed with a 400 (bad data rejected by the API) will be re-rejected if re-queued. Photos for 400-failed observations are deleted by sync before `markFailed` is called, so re-queuing a 400 observation will fail photo upload. Re-queue is most useful for MAX_RETRIES exhaustion (e.g. prolonged network outage). Consider surfacing the failure reason prominently so the block lead can make an informed decision.

## Demoable as

Block lead taps the red "Failed" badge on the home screen, sees the full text of each failed observation with the reason it failed, taps "Dismiss" to clear it (badge count drops) or "Re-queue" to send it back to the pending sync queue (observation reappears as pending).

## Acceptance criteria

- [ ] `FailedObservations` screen lists all rows from `getFailedObservations()` with: text (full, not truncated), field worker name, village name, submitted_at formatted as date/time, failure reason
- [ ] "Dismiss" button removes the observation from `failed_observations` and updates the home screen badge count
- [ ] "Re-queue" button moves the observation back to `pending_observations` (synced = 0, retry_count = 0) and removes it from `failed_observations`
- [ ] Empty state shown when there are no failed observations
- [ ] Home screen badge count updates correctly after dismiss or re-queue without requiring app restart
- [ ] Unit tests cover: `clearFailed` removes the row, `requeueFailed` removes from failed and re-inserts into pending with reset retry_count

## Blocked by

Issue 0001 — `failed_observations` table, `markFailed`, `getFailedObservations`, and the navigation route stub must exist first
