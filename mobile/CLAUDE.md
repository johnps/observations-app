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
