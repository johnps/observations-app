# Mobile — Developer Notes

## expo-file-system v19 (Expo SDK 54+)

All legacy API methods (`makeDirectoryAsync`, `copyAsync`, `deleteAsync`, etc.) imported from `"expo-file-system"` now **throw at runtime** with:

```
Method X imported from "expo-file-system" is deprecated.
```

Use the new class-based API (`File`, `Directory`, `Paths`) or import from `"expo-file-system/legacy"`. This was the root cause of persistent "Could not process photo" errors across multiple builds — the throw was swallowed by a generic `catch` in `addPhoto`, making it look like an image manipulator failure.

The legacy import from `"expo-file-system/legacy"` still works but is not recommended for new code.

## expo-image-manipulator v14 (Expo SDK 54+)

`manipulateAsync` is deprecated and broken in the native module on device — do not use it.

The correct API is:

```typescript
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const context = ImageManipulator.manipulate(uri);
context.resize({ width: Math.min(width, 1280) });
const ref = await context.renderAsync();
const result = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
```

The old namespace import (`import * as ImageManipulator`) also no longer works correctly — use named imports.

In Jest tests, mock the new shape:

```typescript
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
```

And in `beforeEach`, set the default success return:

```typescript
const { ImageManipulator } = require('expo-image-manipulator');
ImageManipulator.manipulate.mockReturnValue({
  resize: jest.fn().mockReturnThis(),
  renderAsync: jest.fn().mockResolvedValue({
    saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///resized.jpg' }),
  }),
});
```

## Sideloading APKs via ADB

Build locally when the EAS free plan monthly Android build limit is exhausted:
```
eas build --platform android --profile apk --local
```

Install with:
```
adb install -r <path-to-apk>
```

**If `adb install` silently stalls** (no progress, no dialog on phone), restart the ADB server:
```
adb kill-server && adb start-server
adb install -r <path-to-apk>
```

Samsung devices may show a Knox security scan prompt during install — dismiss or send it, the install proceeds either way.

## Photo uploads to Supabase Storage (React Native / Android)

React Native's fetch has two hard constraints that break the obvious upload approaches:

1. **`ArrayBuffer` / `Uint8Array` cannot be used as a fetch body.** Attempting it throws at runtime:
   `Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported`

2. **`supabase.storage.from(bucket).upload(path, blob)` fails with `Network request failed`** when the blob is JS-constructed (`new Blob([...])`). The Supabase JS storage client's internal fetch cannot handle JS blobs as a body on Android.

The only fetch body type that works for binary uploads in React Native is a **native RN blob**, produced by `fetch('file://...').blob()`. Use the raw Supabase Storage REST API directly:

```typescript
// Read local file as native RN blob (the only uploadable binary body in RN)
const fileRes = await fetchWithTimeout(uri, {});
const blob = await fileRes.blob();

// Use user session JWT — anon key fails the 'authenticated' RLS policy.
// getSession() is called before the blob fetch; throws if session is null
// rather than falling back to the anon key (which always fails RLS).
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Upload failed: no authenticated session');
const authToken = session.access_token;

const uploadRes = await fetchWithTimeout(
  `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',   // safe to retry without duplicate errors
    },
    body: blob,
  }
);
```

Also ensure the `observation-photos` bucket has an INSERT policy for `authenticated` role — the bucket being "public" only grants read access, not write.

## Debugging lessons learned

**Check device logs before hypothesizing.** When a bug survives multiple fix attempts, run `adb logcat | grep '[your-log-tag]'` before touching any code. The real error is almost always there. Every fix attempt without checking logs first is a guess.

**Generic catch blocks mask the real error.** "Could not process photo" and similar user-facing strings are produced by catch blocks that discard the original exception. Before diagnosing, find the catch, confirm it logs `err`, and read the real message. A bug that looks like an image manipulator failure may be a filesystem failure one layer deeper.

## sync.test.ts — jest.resetModules() pattern

`_resetSyncLock` was a test-only export that leaked internal state. It has been removed. `sync.test.ts` now uses `jest.resetModules()` in `beforeEach` to get a fresh module with a clean lock on each test.

This means the file uses **dynamic `require()` in `beforeEach`** instead of top-level ES imports for the sync module and its mocked dependencies:

```typescript
let syncPending: () => Promise<SyncResult>;
let getPendingObservations: jest.Mock;
// ...

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  const db = require('../lib/db');
  getPendingObservations = db.getPendingObservations;
  // ...
  const sync = require('../lib/sync');
  syncPending = sync.syncPending;
});
```

Do not revert to top-level imports for `sync` or `db` in this file — the lock state would persist across tests.

## Jest mocks for ES default exports — must include `__esModule: true`

When mocking a module that uses a default export (e.g. `import NetInfo from '@react-native-community/netinfo'`), the factory **must** include `__esModule: true`. Without it, Babel's `_interopRequireDefault` wraps the returned object again, making the default export one level deeper than expected and all properties `undefined` at runtime.

```typescript
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));
```

Without `__esModule: true`, `NetInfo.fetch` resolves to `undefined` and every call throws `TypeError: _netinfo.default.fetch is not a function`.

## GPS acquisition pattern on ObservationForm

GPS is acquired **proactively on form mount**, not lazily at submit time. This gives the fix time to resolve while the block lead fills in the form, reducing the miss rate on devices with slow cold-start acquisition.

`locationRef = useRef<{ latitude, longitude } | null>(null)` — holds the fix, no re-render on update.
`gpsStatus = useState<'acquiring' | 'acquired' | 'unavailable'>('acquiring')` — drives the status indicator, triggers re-render.

The mount effect calls `getCurrentPositionAsync` (not `getLastKnownPositionAsync` — the latter only reads the OS cache, which may be stale or empty). On resolve: updates `locationRef.current` and sets status to `'acquired'`. On reject or null: sets status to `'unavailable'`. Submit reads `locationRef.current?.latitude/longitude` directly — no second GPS call.

The status indicator renders near the Submit button. Submit is never blocked by GPS status.

## expo-sqlite mock — `runSync` branch order matters

`__mocks__/expo-sqlite.js` dispatches SQL operations via a chain of `if/else if` on the uppercased SQL string. The generic `INSERT OR REPLACE` check fires before any table-specific checks below it. When adding support for a new table, add the new `else if` branch **before** the generic `INSERT OR REPLACE` branch — otherwise the new table's inserts will be silently routed to `_store` instead of the correct store.
