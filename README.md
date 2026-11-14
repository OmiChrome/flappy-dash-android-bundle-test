<div align="center">

<img src="assets/icon.png" width="128" height="128" alt="Flappy Dash icon" />

# Flappy Dash

**A soft, fluffy one-tap flyer.** Guide Puff through cotton candy towers, grab stars, unlock friends, and beat your best.

Expo SDK 58 · React Native 0.88 · Skia · Reanimated 4 · Expo Router · Bun

</div>

---

## What's in the game

| | |
|---|---|
| 🐤 **6 fluffy friends** | Puff, Berry, Minty, Bluebell, Lilac, Cocoa, unlocked by score, games played or stars collected |
| ☁️ **Cotton candy towers** | Gaps narrow and speed rises up to score 45; from the 8th tower some gaps start drifting up and down |
| ⭐ **Stars** | About 1 in 3 gaps holds a star worth +1 point (also counts toward unlocks) |
| 🌅 **4 skies** | Morning → Sunset → Twilight → Starry, crossfading every 10 points |
| 🏆 **Leaderboard** | Top 25 runs on this device with name, character, stars and date, plus lifetime stats |
| 🎀 **Ribbons** | Sprout 10 · Bloom 20 · Rainbow 30 · Cosmic 50 |
| 🔊 **Sound + haptics** | Synthesised soft sound effects (mix with your music), vibration on flap / score / crash |
| ⏱ **Benchmark mode** | Settings → *Run benchmark*: a seeded 60 s autopilot run that reports avg fps, 1% low, frame-time percentiles and dropped frames |

Controls: tap anywhere (phone) · Space / ↑ / Enter / click (web) · P or Esc to pause.

## Why it runs smoothly now

The first version re-rendered the whole React tree and ~100 SVG views 60 times a second from the JS thread, which lagged on Android. This version:

- **Draws with Skia**: each frame is recorded as one Skia picture. Paths, paints and shaders are built once and reused.
- **Runs the game loop on the UI thread**: `useFrameCallback` plus worklets. Input is a touch-down gesture worklet, so a flap never waits on JavaScript.
- **Keeps React out of the frame loop**: React only re-renders on events (score, death, theme change).
- **Fixed 120 Hz simulation steps**: the same physics on 60, 90 and 120 Hz screens. Long hitches are clamped.
- **Allocates nothing per frame**: pillars and particles live in fixed-size pools.

## Project layout

```
src/
  app/            Expo Router screens: menu, play, leaderboard, settings, bench
  game/
    engine.ts     pure game logic (worklets) + autopilot, unit-tested
    render.ts     Skia renderer (resources built once, drawScene worklet)
    look.ts       characters + sky themes
    GameCanvas.tsx  frame loop, input, picture recording
  lib/            store (AsyncStorage leaderboard), sfx, benchmark stats, Expo Observe wrapper
  ui/             fluffy UI kit (buttons, panels, badges), screen frame, tokens
scripts/          make-assets.ts (icons/splash), make-sounds.ts (WAV synthesis)
```

## Develop

```bash
bun install          # also copies Skia's canvaskit.wasm into public/ for web
bun start            # dev server, then scan the QR code with Expo Go
bun run web          # web in the browser
bun test             # engine, leaderboard and benchmark-stat tests
bun run typecheck
bunx expo lint
```

Regenerate art and sounds: `bun run assets` (needs Playwright) · `bun run sounds`.

### Play in Expo Go (Android)

1. Install **Expo Go** from the Play Store. It must support **SDK 58**.
2. On a PC on the same Wi-Fi: `bun install` then `bun start`.
3. Scan the QR code from the terminal with Expo Go.

Expo Go runs a development build of the JavaScript, so it is slower than the release APK. Use the APK for benchmark numbers. Expo Observe metrics are skipped automatically in Expo Go.

## Ship

| Command | What it does |
|---|---|
| `bun run build:apk` | EAS preview APK (installable) |
| `bun run build:aab` | Play Store bundle |
| `bun run build:ios` | iOS build (needs an Apple developer account) |
| `bun run deploy:web` | export + deploy to EAS Hosting |

Pushing a tag `v*` runs `.github/workflows/release.yml`: checks, EAS APK, web deploy, then a GitHub release with the APK attached.
