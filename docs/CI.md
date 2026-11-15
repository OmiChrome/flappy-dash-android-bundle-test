[🏠 Home](../README.md) · [📊 Benchmark](BENCHMARK.md) · [🦀 Rust benchmark](BENCHMARK-RUST.md) · [📱 Measure on your phone](MEASURING.md) · **⚙️ Cloud builds & tests** · [📐 Port rules](../ports/SPEC.md)

# Cloud builds & tests

Everything builds and tests on GitHub's computers, so you don't need Android Studio, an emulator or a Mac.

## The 4 workflows

| Workflow | What it does | How to start it |
|---|---|---|
| **Release** (`release.yml`) | Builds every Expo format (Android APKs, Play Store AAB, iOS) and publishes a GitHub Release | Actions → Release → *Run workflow* |
| **Ports** (`ports.yml`) | Builds every other framework for every platform it supports, and adds the files to the same release | Actions → Ports → *Run workflow* |
| **Android emulator tests** (`android-test.yml`) | Installs every app on an Android 14 emulator, checks it starts, and benchmarks it | Runs on every push to `main`, or Actions → *Run workflow* |
| **Audio + haptics probe** (`audio-probe.yml`) | Taps a few flaps in every app on an emulator **with sound on**, and checks it opened an audio stream and asked to vibrate | Actions → *Run workflow* |

> **Emulator** = a pretend Android phone running on a computer. GitHub's Linux machines have **KVM** (hardware virtualisation: the CPU runs the phone directly, so it's fast).

## What the emulator test checks (for each app)

1. **Installs** the APK.
2. **Cold start**: time from tapping the icon to the first frame. It's measured 3 times and the middle value is kept.
3. **Smoke test**: is the app still alive after 6 s with no crash? It also takes a screenshot.
4. **Benchmark**: presses *Benchmark (60 s)*, then reads the app's own result from **logcat** (Android's system log).
5. **RAM** (PSS: the app's fair share of memory) and **CPU** (100% = one full core), sampled every 2 s.

The Kotlin app also gets a real **UI test** (`./gradlew connectedDebugAndroidTest`). It checks that the start screen appears and that a tap starts the game.

Results land in the run's **Summary** tab as a table. The screenshots and logcat are in the **emulator-benchmark** artifact.

## Watch it from your PC (GitHub CLI)

Install once: <https://cli.github.com>, then `gh auth login`.

```bash
gh run list --repo OmiChrome/flappy-dash-android-bundle-test --limit 5
```

```bash
gh run watch --repo OmiChrome/flappy-dash-android-bundle-test
```

```bash
gh run view --repo OmiChrome/flappy-dash-android-bundle-test --log-failed
```

```bash
gh run download --repo OmiChrome/flappy-dash-android-bundle-test --name emulator-benchmark
```

Start a run yourself:

```bash
gh workflow run android-test.yml --repo OmiChrome/flappy-dash-android-bundle-test -f tag=v2.1.0
```

## Files

| File | Job |
|---|---|
| [`bench/emulator-bench.sh`](../bench/emulator-bench.sh) | Tests + benchmarks one APK |
| [`bench/emulator-run-all.sh`](../bench/emulator-run-all.sh) | Runs it for every app in the plan |
| [`bench/emulator-summary.py`](../bench/emulator-summary.py) | Makes the results table |
| [`bench/desktop-bench.sh`](../bench/desktop-bench.sh) | Same idea for desktop builds on a virtual screen |
| [`bench/web-bench.cjs`](../bench/web-bench.cjs) | Same idea for web builds in Chrome |
| [`bench/audio-probe.sh`](../bench/audio-probe.sh) | Sound + vibration check for one app ([plan](../bench/audio-plan.txt)) |
| [`bench/apk-size.py`](../bench/apk-size.py) | Shows what's inside an APK |
