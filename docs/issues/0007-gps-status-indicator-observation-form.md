# Issue 0007 — GPS status indicator on observation form

## What to build

Show the block lead whether a GPS fix has been acquired before they submit. The indicator is informational only — Submit is never blocked.

End-to-end path:
- `screens/ObservationForm.tsx` — add `gpsStatus` state (`'acquiring' | 'acquired' | 'unavailable'`); set it alongside the existing `locationRef` updates in the mount effect; render a small status line near the Submit button.

Status transitions:
- On mount → `'acquiring'`
- `getCurrentPositionAsync` resolves with a position → `'acquired'`
- `getCurrentPositionAsync` resolves with null or throws → `'unavailable'`

UI: one line of small text near the Submit button:
- `'acquiring'` → "Acquiring GPS…"
- `'acquired'`  → "GPS acquired"
- `'unavailable'` → "GPS unavailable — observation will be submitted without location"

## Demoable as

Block lead opens the observation form and sees "Acquiring GPS…" briefly, then "GPS acquired" once the fix resolves — giving them confidence to submit with a valid location.

## Acceptance criteria

- [ ] `gpsStatus` state is `'acquiring'` immediately after mount
- [ ] `gpsStatus` becomes `'acquired'` when `getCurrentPositionAsync` resolves with a position
- [ ] `gpsStatus` becomes `'unavailable'` when `getCurrentPositionAsync` returns null or throws
- [ ] Status text is visible on the form near the Submit button
- [ ] Submit is never disabled based on GPS status
- [ ] Unit tests cover all three status states

## Blocked by

None — can start immediately

## Status

Implemented
