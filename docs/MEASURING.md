# Measuring RAM, CPU, frames and size on your Android phone

This guide is for a **Windows 11 PC + Android 14 phone over Wi-Fi**. You don't need an emulator or a USB cable after the first setup.

## 1. One-time setup

### On the PC
1. Download **Android SDK Platform-Tools for Windows**: <https://developer.android.com/tools/releases/platform-tools>
2. Unzip it to `C:\platform-tools`.
3. Open **PowerShell** and check it works:
   ```powershell
   C:\platform-tools\adb.exe version
   ```
   Optional: add `C:\platform-tools` to PATH (Start → "Edit the system environment variables" → Environment Variables → Path → New) so you can just type `adb`.

### On the phone
1. **Settings → About phone → tap "Build number" 7 times** to enable Developer options.
2. **Settings → System → Developer options → Wireless debugging → On.** The phone and PC must be on the **same Wi-Fi**.
3. Tap **"Pair device with pairing code"**. The phone shows an *IP:port* and a *6-digit code*.

### Pair (once per PC)
```powershell
adb pair 192.168.1.23:37185      # the IP:port from the pairing popup
# type the 6-digit code when asked
```

### Connect (each session)
The **Wireless debugging** screen itself shows a *different* IP:port. Use that one:
```powershell
adb connect 192.168.1.23:41567
adb devices                       # should list the phone as "device"
```
If it drops: toggle Wireless debugging off/on and `adb connect` again.

## 2. Install the builds

```powershell
adb install -r expo-android-arm64-v8a.apk
adb shell pm list packages | findstr flappy
```
All Flappy Dash variants share one package id, so installing another variant (Kotlin, Flutter, ...) replaces the previous one. Each port has its own id. See the table in the main README.

## 3. Measure (manual commands)

Replace `PKG` with the package id (for the Expo app: `com.flappydash.game`).

| What | Command | Read this |
|---|---|---|
| **RAM** | `adb shell dumpsys meminfo PKG` | `TOTAL PSS` (the honest number), `TOTAL RSS`, plus the `Native Heap`, `Graphics` and `Code` rows |
| **CPU** | `adb shell top -b -n 5 -d 1 \| findstr PKG` | `%CPU` (100% = one core) |
| **Frames** | `adb shell dumpsys gfxinfo PKG reset`, play 60 s, then `adb shell dumpsys gfxinfo PKG` | `Janky frames`, `50th/90th/95th/99th percentile` |
| **Cold start** | `adb shell am force-stop PKG` then `adb shell am start -W -n PKG/.MainActivity` | `TotalTime` in ms |
| **App size on device** | `adb shell dumpsys package PKG \| findstr codePath` then `adb shell du -sh <codePath>` | installed code size |
| **Battery** | `adb shell dumpsys batterystats --reset`, play 5 min, then `adb shell dumpsys batterystats PKG` | `Estimated power use` |

Notes:
- **PSS vs RSS:** RSS counts shared system libraries in full. PSS splits shared pages fairly between apps. Compare apps by PSS.
- **Skia and Flutter-style renderers** draw through the GPU, so check the `Graphics` / `GL mtrack` rows too.
- `MainActivity` differs per framework. Get the real name with `adb shell cmd package resolve-activity --brief PKG`.
- `gfxinfo` sees only frames that go through Android's own renderer (HWUI). Skia and GL games (Expo/Skia, Flutter, Rust) draw on their own surface, so trust the **in-app benchmark** for those.

## 4. One command for everything

`scripts/measure-android.ps1` runs a cold start, then plays the **in-app benchmark** (autopilot, 60 s) while it samples RAM and CPU every 2 s. It writes a CSV and a summary:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\measure-android.ps1 -Package com.flappydash.game -Label expo-arm64
```

Start the in-app benchmark on the phone when the script says so (Settings → Run benchmark). Then tap **Share results** and send the text to yourself.

## 5. Without a PC

- **In-app benchmark:** Settings → *Run benchmark* (60 s autopilot). It reports avg fps, 1% low, p50/p95/p99 frame time and dropped frames.
- **Developer options → Memory:** average and max RAM per app over 3 h / 6 h / 1 day.
- **Developer options → Profile HWUI rendering → "On screen as bars"** for a live frame-time graph (HWUI apps only).
- **Settings → Apps → Flappy Dash → Storage** for app size, data and cache.
- **Developer options → System Tracing (Perfetto):** record a trace and open it at <https://ui.perfetto.dev> on any computer.

## 6. "Bundle size", "APK size", "install size": what's the difference?

| Term | Meaning | Where you see it |
|---|---|---|
| **JS bundle** | The compiled JavaScript (Hermes bytecode) that React Native/Expo runs. Only JS frameworks have one. | `expo export` → `index-*.hbc` (~4.6 MB here) |
| **APK size** | The file you download and install. It contains native libraries, code (dex), resources and the JS bundle. | file size of the `.apk` |
| **AAB** | Play Store upload format. Google builds a small per-phone APK from it. | not installable directly |
| **Download size** | What a Play Store user downloads (only their CPU + screen density). | Play Console, or `bundletool get-size total` |
| **Install size** | Space used on the phone after installing (APK + extracted/compiled code). | Settings → Apps → Storage |
| **iOS app size** | `.app` inside the `.ipa` (thinned per device by the App Store). | file size of the `.ipa` / App Store Connect |

So "bundle size" is correct only for the JavaScript part. For the whole app, say **app size** (download/APK size, or install size).
