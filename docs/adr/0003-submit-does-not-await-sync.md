# ADR 0003 — Observation submit does not await sync

## Status
Accepted

## Context

The original submit flow in `ObservationForm.handleSubmit` was:
1. Write observation to SQLite queue (`queueObservation`) — instant
2. Await `syncPending()` — up to 30s network timeout
3. Navigate to home screen, passing `wasSynced: result.synced > 0`
4. Home screen showed "✓ Observation submitted" (if synced) or "⏳ Saved offline" (if not)

On slow or absent networks, step 2 caused the submit spinner to hang for up to 30 seconds. Block leads in the field — often on poor connectivity — were closing the app rather than waiting.

## Decision

Decouple sync from navigation:
1. Write to SQLite queue — instant
2. Navigate immediately with `wasSynced: false`
3. Call `syncPending()` fire-and-forget after navigation

The home screen banner now always shows "⏳ Saved offline — will sync when connected." The home screen's `useFocusEffect` already calls `loadCounts()` on every focus, which fetches both the local pending count and the remote synced count — so the counts update accurately within seconds of the background sync completing.

## Trade-offs

**Lost:** The "✓ Observation submitted" success banner when the device is online and sync completes immediately. The user always sees the "Saved offline" message for 4 seconds regardless of connectivity.

**Gained:** Submit is always instant from the user's perspective. The pending/synced counts on the home screen are the authoritative source of sync status.

## Consequences

- Do not re-couple `handleSubmit` to `syncPending()`. The 30s hang is real and was causing users to force-close the app.
- The `wasSynced` param in `RootStackParamList.BlockLeadHome` is now effectively always `false` when set from `ObservationForm`. It is retained in the type in case other callers use it.
- The home screen counts (via `loadCounts`) are the intended place to communicate sync status, not the submission banner.
