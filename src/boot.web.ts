// Skia on web needs CanvasKit (WebAssembly) loaded before any Skia module is evaluated,
// so the router (and every screen) is required only after it is ready.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file: string) => `/${file}` })
  .catch((e: unknown) => console.error('Failed to load CanvasKit', e))
  .then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred on purpose
    require('expo-router/entry');
  });
