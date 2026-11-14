[🏠 Home](../README.md) · [📊 Benchmark](BENCHMARK.md) · [🦀 Rust benchmark](BENCHMARK-RUST.md) · **📱 Measure on your phone** · [⚙️ Cloud builds & tests](CI.md) · [📐 Port rules](../ports/SPEC.md)

# Measure on your phone

For a **Windows PC + Android phone over Wi-Fi**. No cable needed after setup.

## 1. Set up once (5 minutes)

**PC:** download [Android Platform-Tools](https://developer.android.com/tools/releases/platform-tools) and unzip it to `C:\platform-tools`. It contains `adb` (Android Debug Bridge: lets the PC talk to the phone).

**Phone:**
1. Settings → About phone → tap **Build number** 7 times. This turns on Developer options.
2. Settings → System → Developer options → turn on **Wireless debugging**.
3. Tap **Pair device with pairing code**.

**PC (PowerShell), using the IP:port and code the phone shows:**

```bash
C:\platform-tools\adb pair 192.168.1.23:37185
```

Then connect, using the *other* IP:port shown on the Wireless debugging screen:

```bash
C:\platform-tools\adb connect 192.168.1.23:41567
```

```bash
C:\platform-tools\adb devices
```

## 2. Measure one app (one command)

Install the app, open it, then run:

```bash
powershell -ExecutionPolicy Bypass -File scripts\measure-android.ps1 -Package com.flappydash.game -Label expo
```

When it asks, start the in-app benchmark on the phone. You get cold start, RAM, CPU and frame stats in `measurements\`.

| App | Package |
|---|---|
| Expo | `com.flappydash.game` |
| Kotlin · Java · Flutter | `com.flappydash.kotlin` · `.java` · `.flutter` |
| Capacitor | `com.flappydash.capacitor` |
| Rust: macroquad · Slint · Bevy | `com.flappydash.rust` · `.slint` · `.bevy` |
| Rust: Dioxus · Tauri · UniFFI · Crux | `com.flappydash.dioxus` · `.tauri` · `.uniffi` · `.crux` |

## 3. What the numbers mean

| Number | Meaning | Better is |
|---|---|---|
| **Cold start** | Time from tapping the icon to the first picture | lower |
| **RAM (PSS)** | Memory the app uses. *PSS* counts shared system memory fairly between apps | lower |
| **CPU %** | How busy the processor is. 100% = one core fully busy | lower |
| **Avg fps** | Pictures drawn per second. Your screen shows 60, 90 or 120 | higher |
| **1% low** | fps during the worst moments. This is where you *feel* stutter | higher |
| **Dropped frames** | Frames the screen wanted but the app missed | lower |
| **APK size** | The file you install | lower |

## No PC?

- **In-app benchmark**: every app has a *Benchmark (60 s)* button (Expo: Settings → Run benchmark).
- **Developer options → Memory**: average RAM per app.
- **Settings → Apps → *app* → Storage**: installed size.

## "Bundle size" vs "app size"

- **Bundle** = only the JavaScript part of a JS app. For Expo here it's about 4.6 MB.
- **APK / app size** = the whole installable file. That's the number to compare across frameworks.
- **AAB** = the Play Store upload format. Google turns it into a smaller APK per phone.
