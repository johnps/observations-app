# Issue 0008 — GPS accuracy setting and acquisition timeout

## What to build

Two focused improvements to GPS acquisition in `ObservationForm.tsx`:

1. **Accuracy setting** — pass `{ accuracy: Location.Accuracy.Balanced }` to `getCurrentPositionAsync`. The current call uses no options, which defaults to the highest accuracy mode. Balanced accuracy (city-block level) acquires significantly faster on Android, reducing the window during which the block lead might submit without a fix.

2. **Acquisition timeout** — wrap `getCurrentPositionAsync` in a `Promise.race` against a ~15 s timeout. If the race times out, set `gpsStatus` to `'unavailable'` (same path as an error) so the user sees a clear status rather than "Acquiring GPS…" indefinitely on devices with poor signal.

Both changes live entirely in the mount `useEffect` in `screens/ObservationForm.tsx`. The `gpsStatus` state machine and `locationRef` already exist (added in Issue 0007).

## Demoable as

Block lead opens the observation form in an area with weak signal and sees "GPS unavailable — observation will be submitted without location" within ~15 seconds, rather than the spinner hanging indefinitely.

## Acceptance criteria

- [ ] `getCurrentPositionAsync` is called with `{ accuracy: Location.Accuracy.Balanced }`
- [ ] A 15-second timeout races against `getCurrentPositionAsync`; if the timeout fires first, `gpsStatus` is set to `'unavailable'`
- [ ] `gpsStatus` still transitions to `'acquired'` normally when the fix arrives within the timeout
- [ ] Unit tests cover: fix arrives before timeout (acquired), timeout fires before fix (unavailable)
- [ ] Submit is never blocked by GPS status (unchanged from Issue 0007)

## Blocked by

Issue 0007 — GPS status indicator on observation form (must be merged first; state machine and locationRef already in place)
