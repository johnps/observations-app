# Sync Architecture Audit — ODK Comparison
**Date:** 2026-05-04  
**Sources:** OpenRosa form submission spec (`docs.getodk.org/openrosa-form-submission`), ODK Central API idempotency spec (`docs.getodk.org/central-api-submission-management`), ODK Collect source — `InstanceUploader.kt`, `OpenRosaServerInstanceUploader.kt`, `AutoSendSettingsProvider.kt`, `TaskSpecWorker.kt` (github.com/getodk/collect)

---

## What was audited

`mobile/lib/sync.ts`, `mobile/lib/storage.ts`, `mobile/lib/db.ts` against ODK Collect's production sync implementation and the OpenRosa protocol spec. ODK is the direct reference point for offline-first field data collection apps (KoboToolbox, Ona, and CommCare all build on it).

---

## Full findings

### ✅ Followed

| Practice | Where in codebase |
|---|---|
| UUID per observation — server can deduplicate retries | `ObservationForm.tsx` — `uuidv4()` at submit time; `db.ts:24` — `INSERT OR REPLACE` on that UUID |
| Local-first SQLite write queue — UI never blocks on network | `db.ts:23` `queueObservation` is synchronous; `syncPending()` is fire-and-forget |
| Permanent vs transient error classification — 400 discards, others retry | `sync.ts:58–65` — HTTP 400 → discard + `markSynced`; non-OK → `failed++` and retry next cycle |
| Sync concurrency lock — concurrent calls queue, don't pile on | `sync.ts:8–9` — `_syncing` boolean + `_retryOnComplete` flag |
| Delete local files only after server confirms receipt | `sync.ts:53–55` — `deleteAsync` called only after `res.ok`, after `markSynced` |
| Fetch timeouts | `sync.ts:6` — 30s for API; `storage.ts:4` — 60s for photo uploads |

---

### ❌ Not followed — open issues

These three were turned into GitHub issues to fix:

#### 1. No network check before sync → Issue #17
**ODK behaviour:** `AutoSendSettingsProvider` checks `currentNetworkType` before any sync attempt. Returns early if offline. Also supports WiFi-only mode for data-limited users.  
**Current behaviour:** `syncPending()` attempts HTTP immediately with no connectivity check. On a dead connection, each photo upload waits 60s before timing out — 3 photos × 60s = 3 minutes of hangs per observation.  
**Fix:** Check NetInfo before sync; register a NetInfo listener to trigger sync on reconnect.  
**Issue:** [#17 — Skip sync when offline, retry on reconnect](https://github.com/johnps/observations-app/issues/17)

#### 2. No retry cap — zombie records block the queue → Issue #18
**ODK behaviour:** Tracks `STATUS_SUBMISSION_FAILED` per instance. Instances in this state are retried but the status is visible and separable.  
**Current behaviour:** `pending_observations` has no `retry_count` column. A single observation that always triggers a server error (e.g. corrupted photo causing a 500) is retried on every sync cycle forever, blocking all subsequent observations.  
**Fix:** Add `retry_count` column to SQLite; increment on failure; skip and permanently fail at 5 attempts.  
**Issue:** [#18 — Cap retries at 5 to prevent zombie observations blocking the queue](https://github.com/johnps/observations-app/issues/18)

#### 3. No exponential backoff between retry cycles → Issue #19
**ODK behaviour:** Uses Android WorkManager's exponential backoff (starting 30s, doubling, capped at 18000s) when `Result.retry()` is returned.  
**Current behaviour:** Failed syncs are retried immediately on the next `syncPending()` call with no spacing. Hammers a down server and burns mobile data.  
**Fix:** In-memory `_backoffMs` state in `sync.ts`; doubles after each failed cycle (30s → 60s → 120s → 240s → 900s cap); resets to 0 on full success.  
**Blocked by:** #17 (backoff should apply to the reconnect-triggered retry path).  
**Issue:** [#19 — Exponential backoff between retry cycles](https://github.com/johnps/observations-app/issues/19)

---

### ❌ Not followed — deliberately deferred

These gaps were identified but ruled out as too complex for the current scale (10-user field app):

#### 4. Non-atomic submission (photos and data are separate requests)
**ODK behaviour:** OpenRosa protocol sends the submission XML + all attachments as a single multipart MIME request. If any part fails, the whole submission fails atomically — nothing is written to the server.  
**Current behaviour:** `storage.ts` uploads photos to Supabase Storage first, then `sync.ts` POSTs the observation JSON separately. If the JSON POST fails after photos upload, photos exist in cloud storage but the observation record doesn't. On retry, photos are re-uploaded to the same path (`obsId/0.jpg`) — idempotent by path collision, not by design.  
**Why deferred:** Fixing this requires either base64-encoding photos into the JSON payload (bad for 200–400KB images) or adding server-side partial-upload tracking (significant backend complexity). The current path-collision idempotency works in practice.  
**Revisit when:** Upload failures start showing orphaned photos in Supabase Storage, or photo re-upload bandwidth becomes a concern.

#### 5. Sync does not survive app restart (no WorkManager equivalent)
**ODK behaviour:** Android WorkManager persists work across restarts, crashes, and reboots. Even process death doesn't lose a queued sync.  
**Current behaviour:** `_syncing` and `_retryOnComplete` are module-level variables. They reset on every app restart. If the app is killed mid-sync, the state is lost. Sync only runs again when the user opens the app and the home screen calls `syncPending()`.  
**Why deferred:** `expo-background-fetch` is heavily restricted on Android (battery optimisation kills it on Samsung) and iOS. WorkManager-level reliability is not achievable via Expo. The current pattern (sync on app open) is acceptable for the usage pattern — block leads open the app to submit, which triggers sync.  
**Revisit when:** Users report observations not syncing even after returning to connectivity (i.e. the "open app = sync" assumption breaks down).

#### 6. No HEAD pre-negotiation before POST
**ODK behaviour:** OpenRosa spec recommends a HEAD request before each POST to negotiate `X-OpenRosa-Accept-Content-Length` and complete auth before sending the full payload.  
**Why deferred:** Near-zero value — this app controls its own server and Supabase Storage's limits are well above the payload sizes in use.  
**Revisit when:** Never, unless the server is replaced with a third-party OpenRosa endpoint.

---

## Summary table

| Practice | ODK | This app | Status |
|---|---|---|---|
| UUID per submission | ✅ | ✅ | Done |
| Local-first SQLite queue | ✅ | ✅ | Done |
| Permanent vs transient error split | ✅ | ✅ | Done |
| Sync concurrency lock | ✅ | ✅ | Done |
| Delete local files after confirm | ✅ | ✅ | Done |
| Fetch timeouts | ✅ | ✅ | Done |
| Network check before sync | ✅ | ❌ | Issue #17 |
| Retry cap per record | ✅ | ❌ | Issue #18 |
| Exponential backoff | ✅ | ❌ | Issue #19 |
| Atomic submission (data + files) | ✅ | ❌ | Deferred — complexity vs scale |
| Sync survives app restart | ✅ | ❌ | Deferred — Expo/Android limitations |
| HEAD pre-negotiation | ✅ | ❌ | Deferred — not applicable |
