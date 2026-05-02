# GPS flag indicates coordinate presence, not village proximity

In the MVP, the ✅/🚩 GPS flag on an observation indicates whether a GPS coordinate was captured at all — not whether the coordinate is within a threshold distance of the village. A present coordinate is ✅; a missing or zero coordinate is 🚩.

The original PRD implied proximity-based validation (within 2km of inferred village coordinates), but village-coordinate inference requires accumulating GPS readings over time and is post-MVP. Rather than ship a flag that always shows 🚩 (no inferred coordinates yet) or drop the flag entirely, we use presence as a useful proxy: it reliably catches desk submissions where no GPS was captured. When village-coordinate inference ships, the flag logic upgrades to proximity-based without a schema change — the coordinate field is already stored on every observation.
