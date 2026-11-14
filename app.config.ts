// Dynamic layer over app.json, driven by env vars set per EAS build profile (eas.json):
//   EXPO_ANDROID_ARCHS  comma list of ABIs to build (default: all four)
//   EXPO_ANDROID_MINIFY "1" turns on R8 code shrinking + resource shrinking
import type { ConfigContext, ExpoConfig } from 'expo/config';

const ALL_ARCHS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'];

export default ({ config }: ConfigContext): ExpoConfig => {
  const archs = (process.env.EXPO_ANDROID_ARCHS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const minify = process.env.EXPO_ANDROID_MINIFY === '1';
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            buildArchs: archs.length ? archs : ALL_ARCHS,
            enableMinifyInReleaseBuilds: minify,
            enableShrinkResourcesInReleaseBuilds: minify,
          },
        },
      ],
    ],
  };
};
