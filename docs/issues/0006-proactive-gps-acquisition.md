# Issue 0006 — Proactive GPS acquisition on form mount

## What to build

Replace the cold cache lookup at submit time with a proactive background location request when the observation form opens. The fix resolves in the background while the block lead is writing — by the time Submit is tapped, the position is already available in component state.

End-to-end path:
- `screens/ObservationForm.tsx` — in the existing `useEffect` that runs on mount, call `Location.getCurrentPositionAsync()` after the permission request; store the result in a `locationRef` (a `useRef` so it never triggers re-renders). At submit time, read from `locationRef.current` instead of calling `getLastKnownPositionAsync`.

## Demoable as

A block lead opens a new observation form at home on a good network connection, writes their observation, and taps Submit — the observation is saved with GPS coordinates, not as a 🚩 flag.

## Acceptance criteria

- [ ] `getCurrentPositionAsync` is called once when the form mounts (not at submit time)
- [ ] The resolved position is held in a ref, not state (no re-render on fix)
- [ ] At submit time, `gps_lat`/`gps_lng` are read from the ref — no additional location call
- [ ] If `getCurrentPositionAsync` fails or times out, the ref stays null and the observation submits without GPS (existing graceful degradation is preserved)
- [ ] `getLastKnownPositionAsync` is removed — no longer used
- [ ] Unit tests cover: GPS resolved before submit → coords included; GPS not resolved before submit → observation still submits without coords

## Blocked by

None — can start immediately
