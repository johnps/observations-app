# Issue 0008 — GPS accuracy setting and acquisition timeout

## What to build

Two focused improvements to GPS acquisition in `ObservationForm.tsx`:

1. **Accuracy setting** — pass `{ accuracy: Location.Accuracy.High }` to `getCurrentPositionAsync`. The current call uses no options. `High` uses the GPS chipset directly (5–15 m accuracy), which is the right choice for block leads who are physically outdoors in a village. `Balanced` is faster in urban/suburban areas because it shortcuts via cell towers and WiFi, but in rural India that infrastructure is sparse — `Balanced` loses its speed advantage and may give worse accuracy (300–500 m) or time out anyway. `High` with a timeout is more reliable in low-infrastructure environments.

2. **Acquisition timeout** — wrap `getCurrentPositionAsync` in a `Promise.race` against a ~15 s timeout. If the race times out, set `gpsStatus` to `'unavailable'` (same path as an error) so the user sees a clear status rather than "Acquiring GPS…" indefinitely on devices with poor signal. The timeout is the primary fix for the hang; the accuracy setting ensures reliable positioning when a fix is obtained.

Both changes live entirely in the mount `useEffect` in `screens/ObservationForm.tsx`. The `gpsStatus` state machine and `locationRef` already exist (added in Issue 0007).

## Demoable as

Block lead opens the observation form in an area with weak signal and sees "GPS unavailable — observation will be submitted without location" within ~15 seconds, rather than the spinner hanging indefinitely.

## Acceptance criteria

- [ ] `getCurrentPositionAsync` is called with `{ accuracy: Location.Accuracy.High }`
- [ ] A 15-second timeout races against `getCurrentPositionAsync`; if the timeout fires first, `gpsStatus` is set to `'unavailable'`
- [ ] `gpsStatus` still transitions to `'acquired'` normally when the fix arrives within the timeout
- [ ] Unit tests cover: fix arrives before timeout (acquired), timeout fires before fix (unavailable)
- [ ] Submit is never blocked by GPS status (unchanged from Issue 0007)

## Blocked by

Issue 0007 — GPS status indicator on observation form (must be merged first; state machine and locationRef already in place)
