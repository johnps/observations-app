# Issue 0009 — GPS retry button on observation form

## What to build

When GPS acquisition fails or times out, the block lead currently sees "GPS unavailable — observation will be submitted without location" with no way to retry except closing the form (which loses entered text).

Add a "Retry GPS" affordance inline with the status text. Tapping it resets `gpsStatus` to `'acquiring'` and re-runs `getCurrentPositionAsync` with the same 15 s timeout as the initial attempt (from Issue 0008). On success, `locationRef.current` is updated and `gpsStatus` becomes `'acquired'`. On failure, `gpsStatus` returns to `'unavailable'` and the retry option appears again.

`observationText`, `photoUris`, `selectedWorker`, and `selectedVillage` are all in separate `useState` — none are affected by a GPS retry.

## Demoable as

Block lead fills in observation text, sees "GPS unavailable", taps "Retry GPS", waits a few seconds, and sees "GPS acquired" — all without losing any entered text.

## Acceptance criteria

- [ ] When `gpsStatus === 'unavailable'`, a "Retry GPS" button/link is shown alongside the status text
- [ ] Tapping it sets `gpsStatus` to `'acquiring'` and re-runs `getCurrentPositionAsync` with `{ accuracy: Location.Accuracy.High }` and a 15 s timeout
- [ ] On success: `locationRef.current` updated, `gpsStatus` → `'acquired'`, retry button disappears
- [ ] On timeout or error: `gpsStatus` → `'unavailable'`, retry button reappears
- [ ] No entered text, photos, or picker selections are lost during retry
- [ ] Unit tests cover: retry succeeds, retry fails

## Blocked by

Issue 0008 — GPS accuracy and timeout (retry reuses the same timeout wrapper)
