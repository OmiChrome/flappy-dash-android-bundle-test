[🏠 Home](../README.md) · **📊 Benchmark** · [🦀 Rust benchmark](BENCHMARK-RUST.md) · [📱 Measure on your phone](MEASURING.md) · [⚙️ Cloud builds & tests](CI.md) · [📐 Port rules](../ports/SPEC.md)

# Benchmark: production-ready frameworks

The same game, built 6 ways. Only frameworks that are **stable** (version 1.0 or later, used in real shipped apps) are listed here. Every Rust option, stable or not, is in the [Rust benchmark](BENCHMARK-RUST.md).

## 1. Size: what you download

APK for **one arm64 phone** (almost every phone sold since 2017):

| Framework | APK | What's inside |
|---|---:|---|
| ![](https://cdn.simpleicons.org/openjdk/ED8B00) Java + Android Views | **0.07 MB** | Only our code. The drawing engine is built into Android |
| ![](https://cdn.simpleicons.org/kotlin/7F52FF) Kotlin + Jetpack Compose | **0.83 MB** | Our code + the Compose UI library |
| ![](https://cdn.simpleicons.org/capacitor/119EFF) Capacitor | **5.2 MB** | The Expo web build, shown in the phone's own WebView (built-in browser) |
| ![](https://cdn.simpleicons.org/rust/000000) Slint (Rust) | **6.0 MB** | Our Rust code + Slint's renderer |
| ![](https://cdn.simpleicons.org/flutter/02569B) Flutter | **15.0 MB** | Flutter engine 10.8 MB + our Dart code 3.1 MB |
| ![](https://cdn.simpleicons.org/expo/000020) Expo / React Native | **44.1 MB** | Skia 13.7 MB · React Native 6.7 MB · Hermes (JS engine) 2.6 MB · Reanimated 2.8 MB · code 3.4 MB · JS + assets 3.6 MB |

> **Why is Expo so big?** It isn't Expo itself (about 1.5 MB). It's the **Skia** drawing library we added for smooth graphics (13.7 MB), plus the React Native and JavaScript engines (about 10 MB). Without Skia it would be about 30 MB.

Other CPU types are in the [release](../../../releases): armv7 (old 32-bit phones), x86_64 / x86 (emulators), and *universal* (all CPU types in one bigger file).

## 2. Speed and memory: Android 14 emulator

Every app ran the **same 60-second autopilot course** on the same emulator ([how](CI.md)).

| Framework | Cold start | RAM | CPU | Avg fps | 1% low fps | Dropped frames |
|---|---:|---:|---:|---:|---:|---:|
| Slint (Rust) ¹ | **0.67 s** | 41 MB | 52 % | **19.8** | **13** | **36 %** |
| Java + Views | 1.49 s | **22 MB** | 65 % | 11.2 | 5 | 60 % |
| Kotlin + Compose | 2.04 s | 28 MB | 56 % | 9.9 | 4 | 65 % |
| Flutter | 3.79 s | 60 MB | 58 % | 9.0 | 5 | 70 % |
| Expo / React Native | 4.25 s | 125 MB | 45 % | 5.9 | 3 | 79 % |
| Capacitor ² | 1.32 s | 79 MB | 91 % | – | – | – |

**What the columns mean**
- **Cold start:** time from tapping the icon to the first picture.
- **RAM:** memory used. It's measured as *PSS*, which splits memory shared with other apps fairly.
- **CPU:** 100 % = one processor core fully busy.
- **fps:** pictures drawn per second. **1% low** is the fps during the worst moments, which is where you *feel* stutter.
- **Dropped frames:** frames the screen wanted but the app was too slow to draw.

**Read this before comparing**
- The emulator has **no real GPU**. It draws in software at 30 Hz, so every fps number is low. A real phone is many times faster. Use the table to see **who is faster than whom**, not real speeds.
- ¹ Slint draws a slightly simpler picture (circles and rectangles instead of curved paths and gradients). That helps its fps. Its cold start, RAM and size are still directly comparable.
- ² Capacitor's benchmark button is inside a web page, which the test robot couldn't press. Its start, RAM and CPU were measured.

## 3. Verdict

| If you want… | Pick | Why |
|---|---|---|
| Smallest, fastest Android-only app | **Java / Kotlin** | Tiny APK, least RAM, and no extra engine. Kotlin + Compose is the modern choice |
| One codebase for Android + iOS + web, with a team that knows React | **Expo** | Biggest download and slowest start, but huge library support and over-the-air updates |
| One codebase for every platform, smooth graphics | **Flutter** | 3× smaller than Expo and uses half the RAM |
| Rust, production-ready | **Slint** | Fastest start, lowest stutter of everything tested, 6 MB |
| Reuse an existing website as an app | **Capacitor** | 5 MB, but runs inside a browser view and used the most CPU |

## 4. Web builds (same browser, no GPU)

| Build | First download | fps | Memory |
|---|---:|---:|---:|
| Flutter web | 7.4 MB | 25.6 | 205 MB |
| Expo web | 10.8 MB | 12.8 | 181 MB |

Rust web builds are in the [Rust benchmark](BENCHMARK-RUST.md#web).

## Raw data and tools

- Emulator: [`bench/results/emulator-api34.json`](../bench/results/emulator-api34.json)
- Web: [`bench/results/web-headless-chromium.json`](../bench/results/web-headless-chromium.json)
- Size breakdown: [`bench/apk-size.py`](../bench/apk-size.py)
- Measure on **your** phone: [MEASURING.md](MEASURING.md)
