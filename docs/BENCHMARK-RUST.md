[🏠 Home](../README.md) · [📊 Benchmark](BENCHMARK.md) · **🦀 Rust benchmark** · [📱 Measure on your phone](MEASURING.md) · [⚙️ Cloud builds & tests](CI.md) · [📐 Port rules](../ports/SPEC.md)

# Rust benchmark: 8 ways to ship Rust on mobile

Every port runs the same game engine (`ports/rust/core`, a shared Rust library), so differences come from the **framework**, not the game code.

## The 8 options in one line each

| Framework | Version | Stable? | How it works |
|---|---|:---:|---|
| **Slint** | 1.18 | ✅ | Rust + Slint's own UI language; draws with its own GPU renderer |
| **Tauri** | 2.12 | ✅ | A web page (our Expo web build) in the phone's WebView; Rust is the app shell |
| **UniFFI** | 0.32 | ⚠️ | Not a UI framework: it **generates Kotlin code** so Kotlin can call Rust. Game in Rust, drawing in Kotlin |
| **Crux** | 0.20 | ⚠️ | "Headless core": all logic in Rust, a thin native UI (Kotlin here) asks it what to show |
| **Dioxus** | 0.7 | ⚠️ | React-style Rust UI; on phones it draws HTML/SVG in a WebView |
| **Bevy** | 0.20 | ⚠️ | Full game engine (ECS = entity/component/system data model) on Vulkan/GPU |
| **macroquad** | 0.4 | ⚠️ | Tiny game library: draw shapes with simple function calls |

✅ = version 1.0 or later. ⚠️ = before 1.0, so the API can still change.

> **Crux note:** Crux normally connects to the native UI through its own "Bridge", which sends serialized bytes, plus generated types. We call the Crux core through UniFFI-typed functions instead, to keep the Kotlin side to one file. The core itself (events → update → view model) is standard Crux.

## Size (Android APK, arm64)

| Framework | APK | Notes |
|---|---:|---|
| macroquad | **0.44 MB** | Game + renderer + window in one 0.37 MB library |
| UniFFI | 1.45 MB | Rust library + JNA (lets Kotlin call native code) + Compose |
| Crux | 1.53 MB | Same as UniFFI, plus the Crux core |
| Dioxus | 3.6 MB | Rust + WebView glue |
| Slint | 6.0 MB | Includes Skia (its GPU drawing library) |
| Tauri | 9.6 MB ¹ | Rust shell for all 4 CPU types + the Expo web build (about 4 MB compressed) |
| Bevy | 11.9 MB | Whole game engine + wgpu (GPU layer) |

¹ The `v2.1.0` Tauri build was one APK for all CPU types; per-CPU APKs are in later runs.

## Speed and memory (Android 14 emulator, software GPU)

| Framework | Cold start | RAM | CPU | Avg fps | 1% low | Dropped |
|---|---:|---:|---:|---:|---:|---:|
| **Slint** | **0.67 s** | 41 MB | 52 % | **19.8** | **13** | 36 % |
| Crux | 0.98 s | **28 MB** | 54 % | 18.8 | 9 | **28 %** |
| UniFFI | 1.26 s | **28 MB** | 56 % | 18.6 | 8 | 31 % |
| Dioxus | 1.20 s | 72 MB | 86 % | 16.9 | 9 | 48 % |
| Bevy | 1.19 s | 98 MB | 77 % | – ² | – | – |
| macroquad | – | – | – | – ³ | – | – |
| Tauri | (next run) | | | | | |

- The emulator has no real GPU, so all fps numbers are low. Compare rows with each other.
- All rows above draw the **same simplified picture** (circles and rectangles from the shared draw list), so this table is a fair fight.
- ² Bevy started fine (smoke test ✅) but didn't log its benchmark result within 100 s.
- ³ macroquad closes right after launch on the x86_64 emulator image. It runs fine on desktop and web; arm64 phones are untested.

## Desktop (Linux, no GPU, virtual screen) {#desktop}

| Framework | RAM | Binary |
|---|---:|---:|
| macroquad | **117 MB** | **0.9 MB** |
| Slint | 150 MB | 11.2 MB |
| Bevy | 214 MB | 39.4 MB |

## Web (same browser, no GPU) {#web}

| Build | Download | fps | Main thread busy |
|---|---:|---:|---:|
| Dioxus (SVG) | 0.3 MB | **60** | **13 %** |
| macroquad (WebGL) | 0.54 MB | 52.8 | 99 % |

Without a GPU, WebGL (macroquad) is emulated in software and costs the most. Dioxus's SVG takes the browser's cheaper CPU drawing path. On a real GPU, WebGL usually wins.

## Verdict

| Want | Pick |
|---|---|
| Best all-round, production-ready | **Slint**: fastest start, smoothest, stable 1.x, 6 MB |
| Keep a 100 % native UI, share logic in Rust | **Crux** (structured) or **UniFFI** (simple bindings): lowest RAM, about 1.5 MB |
| Web skills, small app | **Tauri** (stable) |
| React-style Rust UI | **Dioxus**, but it uses a WebView, so more RAM and CPU |
| Smallest possible game | **macroquad** (0.44 MB) |
| Big 2D/3D game | **Bevy**: heaviest here, but a full engine |

The best Rust option overall is in the main [Benchmark](BENCHMARK.md) next to Expo, Flutter and native Android.

Raw data: [`bench/results/`](../bench/results) · Code: [`ports/rust/`](../ports/rust) · Rules every port follows: [SPEC](../ports/SPEC.md)
