# Mobile — Developer Notes

## expo-image-manipulator v14 (Expo SDK 54+)

`manipulateAsync` is deprecated and broken in the native module on device — it will throw silently, resulting in "Could not process photo" errors. Do not use it.

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
