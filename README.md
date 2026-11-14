# Flappy Dash 🐤
Expo (SDK 58) + Bun. Pure-SVG art, tap/click/Space to flap. Android-first, also iOS + web.

## Daily commands
| | |
|-|-|
| `bun install` | install |
| `bun start` | dev server (scan QR in Expo Go / dev build) |
| `bun run android` / `ios` / `web` | run on a platform |
| `bun test` | game-logic unit tests |
| `bun run check` | typecheck + tests + web & android bundle export |
| `bun run assets` | regenerate icons (needs `playwright` available) |

## Ship (one-time: `bunx eas-cli login`, then `bunx eas-cli init`)
| | |
|-|-|
| `bun run build:apk` | installable Android APK (cloud build) — use this to play on your phone |
| `bun run build:aab` | Play Store bundle |
| `bun run build:ios` | iOS build (needs Apple developer account) |
| `bun run deploy:web` | export + deploy web to EAS Hosting |
| `bun run submit:android` | upload latest AAB to Play Store |

Change `com.flappydash.game` in app.json (ios.bundleIdentifier / android.package) to your own id before store release.

## Automated release (GitHub Actions)
Add repo secret `EXPO_TOKEN`, then:
```bash
git tag v1.0.1 && git push origin v1.0.1
```
`.github/workflows/release.yml` checks, builds the APK on EAS, deploys web, and publishes the GitHub release with the APK attached. It can also be run manually from the Actions tab.
