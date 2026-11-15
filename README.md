<div align="center">

<img src="assets/icon.png" width="110" height="110" alt="Flappy Dash icon" />

# Flappy Dash

**A fluffy one-tap flying game, built in 12 frameworks to see what each one really costs.**

**🏠 Home** · [📊 Benchmark](docs/BENCHMARK.md) · [🦀 Rust benchmark](docs/BENCHMARK-RUST.md) · [📱 Measure on your phone](docs/MEASURING.md) · [⚙️ Cloud builds & tests](docs/CI.md) · [📐 Port rules](ports/SPEC.md)

**[⬇ Download (Releases)](../../releases)** · **[▶ Play in the browser](https://flappy-dash.expo.app)**

</div>

## The short answer

| | Framework | APK (arm64) | RAM | Cold start | Smoothness ¹ | Sound · vibration |
|---|---|---:|---:|---:|:---:|:---:|
| ![](https://cdn.simpleicons.org/openjdk/ED8B00) | **Java + Android Views** | 0.19 MB | 23 MB | 1.7 s | ★★★☆ | ✅ ✅ |
| ![](https://cdn.simpleicons.org/kotlin/7F52FF) | **Kotlin + Jetpack Compose** | 0.95 MB | 29 MB | 3.1 s | ★★☆☆ | ✅ ✅ |
| ![](https://cdn.simpleicons.org/rust/000000) | **Slint (Rust)** ² | 6.2 MB | 42 MB | **0.8 s** | ★★★★ | ✅ ✅ |
| ![](https://cdn.simpleicons.org/capacitor/119EFF) | **Capacitor** (web app in a shell) | 5.2 MB | 78 MB | 1.9 s | – | ✅ ❌ ³ |
| ![](https://cdn.simpleicons.org/flutter/02569B) | **Flutter** | 15.2 MB | 62 MB | 5.1 s | ★★☆☆ | ✅ ✅ |
| ![](https://cdn.simpleicons.org/expo/000020) | **Expo / React Native** | 44.1 MB | 121 MB | 4.2 s | ★☆☆☆ | ✅ ✅ |

<sub>Measured on an Android 14 emulator running the same 60-second autopilot course in every app (release v2.2.0). ¹ Stars come from frame rate and "1% low" (how bad the worst stutters are). ² The best production-ready Rust option (it draws a slightly simpler picture, which helps its smoothness); all 8 Rust options are in the [Rust benchmark](docs/BENCHMARK-RUST.md). ³ The test robot saw no vibration; it most likely never got past the menu. Full numbers and caveats: [Benchmark](docs/BENCHMARK.md).</sub>

**In plain words**
- **Native Android (Java/Kotlin)** is tiny and light. It's the right choice if you only need Android.
- **Expo** costs about 44 MB and 120 MB of RAM. You pay for one codebase across Android, iOS and web, React skills, and instant updates. Most of the size is the Skia graphics library this game uses, not Expo itself.
- **Flutter** gives you every platform at a third of Expo's size and half its RAM.
- **Slint (Rust)** started fastest and stuttered least of everything tested.

**A friend's advice**
- **Normal app:** Jetpack Compose on Android; UIKit (slightly faster) or SwiftUI on iPhone.
- **Game:** Flutter.

**Next port idea, for the love of the game:** LVGL + Java JNI. LVGL is a tiny C graphics library made for watches and smart appliances. JNI (Java Native Interface) lets a thin Java app call it.

## What's in the game

🐤 6 fluffy characters · ☁️ cotton-candy towers that speed up · ⭐ stars to collect · 🌅 4 skies · 🏆 leaderboard + stats · 🔊 sounds + vibration · ⏱ built-in 60-second benchmark

<div align="center">
<img src="docs/screens/menu.png" width="170" alt="Menu" /> <img src="docs/screens/play.png" width="170" alt="Playing" /> <img src="docs/screens/gameover.png" width="170" alt="Game over" /> <img src="docs/screens/leaderboard.png" width="170" alt="Leaderboard" />
</div>

## Download

Open **[Releases](../../releases)** on your phone and pick the file that ends in **`-arm64-v8a.apk`**; that fits almost every phone. Each framework installs as its own app, so you can keep them all side by side.

| You want | File |
|---|---|
| The full game (Expo) | `expo-android-arm64-v8a.apk` |
| Compare frameworks | `kotlin-compose-…`, `java-views-…`, `flutter-…-arm64-v8a`, `capacitor-…`, `rust-…-arm64-v8a` |
| Windows / Mac / Linux | `flutter-windows-x64.zip`, `rust-slint-windows-x64.exe`, … |
| iPhone | Size reference only: installing needs an Apple developer account |

## Where to go next

| I want to… | Read |
|---|---|
| See all the numbers | [📊 Benchmark](docs/BENCHMARK.md) |
| Compare every Rust option | [🦀 Rust benchmark](docs/BENCHMARK-RUST.md) |
| Measure RAM/CPU on my own phone | [📱 Measure on your phone](docs/MEASURING.md) |
| Understand the cloud tests | [⚙️ Cloud builds & tests](docs/CI.md) |
| Port the game to another framework | [📐 Port rules](ports/SPEC.md) |

## Run the Expo app yourself

```bash
bun install
```

```bash
bun start
```

Scan the QR code with **Expo Go** (it must support SDK 58). Tests: `bun test` · Type check: `bun run typecheck` · Lint: `bunx expo lint`.

<details>
<summary>Project layout</summary>

```
src/                 Expo app (screens, Skia renderer, game engine, leaderboard, sounds)
ports/               the same game in other frameworks
  kotlin-compose/ java-views/ flutter/ capacitor/
  rust/              Rust workspace: core (shared engine) + macroquad, slint, bevy, dioxus, uniffi, crux, tauri
  uniffi-android/ crux-android/   Kotlin apps for the UniFFI and Crux Rust cores
bench/               benchmark scripts + raw results
docs/                benchmark, measuring and CI guides
.github/workflows/   release.yml (Expo) · ports.yml (all other frameworks) · android-test.yml (emulator tests)
```
</details>
