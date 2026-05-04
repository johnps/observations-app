# Architecture Review — 2026-05-03

## Candidates

### 1. The pending observation payload is a secret contract between four files

`db.ts` stores observations as raw JSON strings in a `payload` column. `sync.ts`, `MyObservations.tsx`, and `ObservationForm.tsx` all independently parse and construct that JSON with no shared type. Apply the deletion test: delete `db.ts`'s type knowledge and the shape assumptions scatter to every caller — that's complexity the module should own. The module currently exposes a deep storage operation through a shallow interface that says nothing about what it stores.

**Files:** `mobile/lib/db.ts`, `mobile/lib/sync.ts`, `mobile/screens/MyObservations.tsx`, `mobile/screens/ObservationForm.tsx`

---

### 2. `syncPending()` has a concurrency contract that's invisible from its signature

When a sync is already running, `syncPending()` silently returns `{ synced: 0, failed: 0, errors: [] }` — indistinguishable from "queue was empty." The lock mechanism (`_syncing`, `_retryOnComplete`) is essential behavior that callers in `App.tsx` can't observe. The test-only `_resetSyncLock()` export is a seam leak: internal state escaping through a hole cut for tests rather than through the interface. The module is shallow here — its lock behavior is real depth that its interface doesn't surface.

**Files:** `mobile/lib/sync.ts`, `mobile/App.tsx`, `mobile/__tests__/sync.test.ts`

---

### 3. `ObservationForm` duplicates `syncHierarchy`'s job

The form has its own fetch-or-cache logic for field workers and villages (two `useEffect` hooks, raw `fetch`, no timeout). `syncHierarchy` in `sync.ts` does the same job with proper timeouts, caching, and error handling — it's called on app launch and foreground. So there are two independent code paths for the same data, with different reliability characteristics. The form's fetch path has no timeout and no retry; `syncHierarchy` has both. A `useHierarchy` hook would be the seam between the form and the hierarchy data, with one authoritative fetch path behind it.

**Files:** `mobile/screens/ObservationForm.tsx`, `mobile/lib/sync.ts`, `mobile/lib/db.ts`

---

### 4. `hierarchy.ts` exposes its implementation steps instead of its outcome

`parseCSV`, `previewChanges`, and `applyChanges` are always called in sequence by the admin import route. The module exports the pipeline's internal stages rather than the operation the caller actually wants: "import this CSV." Callers must compose these three functions in the right order with no transactional guarantee covering the whole import. Deeper: a single `importHierarchy(csv)` that returns `{ added, updated, removed }` concentrates the parsing, validation, preview, and apply into one place — the caller just invokes it and reads the result.

**Files:** `web/lib/hierarchy.ts`, and the admin hierarchy import API route

---

### 5. Role-routing logic is duplicated across mobile and web with different error handling

`LoginScreen.tsx` and `web/app/page.tsx` both independently fetch `/api/users/role` and derive a destination screen/path from the result. The mobile version has retry logic; the web version doesn't. If a new role is added, both files need updating. The API could return the route directly (role + canonical destination), or a shared `resolveRoleRoute(email)` utility could be the single place this rule lives.

**Files:** `mobile/screens/LoginScreen.tsx`, `web/app/page.tsx`, `web/app/api/users/role/route.ts`
