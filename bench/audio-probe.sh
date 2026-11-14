#!/usr/bin/env bash
# Plays a few flaps in one app and reports whether the app opened an audio stream and vibrated.
# Usage: bench/audio-probe.sh <name> <apk> <package> <out-dir> [start-tap-text]
name=$1; apk=$2; pkg=$3; out=$4; start=${5:-}
mkdir -p "$out"; log="$out/$name.txt"
adb install -r -g "$apk" >/dev/null
adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
size=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${size%x*}; H=${size#*x}
if [ -n "$start" ]; then
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  b=$(adb exec-out cat /sdcard/ui.xml | grep -oE "text=\"$start\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]' | head -1)
  if [ -n "$b" ]; then set -- $(echo "$b" | grep -oE '[0-9]+'); adb shell input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 )); fi
  sleep 3
fi
for i in 1 2 3 4 5 6; do adb shell input tap $((W/2)) $((H/2)); sleep 0.35; done
sleep 1
pid=$(adb shell pidof "$pkg" | tr -d '\r')
{
  echo "== $name ($pkg) pid=$pid"
  echo "-- audio players created by this app (dumpsys audio playback configs)"
  adb shell dumpsys audio | grep -E "AudioPlaybackConfiguration" | grep -E "u/pid:[0-9]+/$pid|pid:$pid" | head -20
  echo "-- player events (newest)"
  adb shell dumpsys audio | grep -iE "player|piid" | grep -E "$pid" | tail -10
  echo "-- vibrations by this app"
  adb shell dumpsys vibrator_manager | grep -E "$pkg|uid" | grep -i "$pkg" | tail -5
  echo "-- logcat (audio/errors)"
  adb logcat -d | grep -iE "ReactNativeJS|ExoPlayer|Media3|AudioTrack|MediaPlayer|SoundPool|expo.*audio|AndroidRuntime|AudioFocus" | grep -vE "chatty" | tail -40
} > "$log" 2>&1
cat "$log"
# one line per app for the summary: did it open an audio stream, did it vibrate?
players=$(adb shell dumpsys audio | grep -cE "new player .*pid:[0-9]+/$pid |uid/pid:[0-9]+/$pid " || true)
vibes=$(adb shell dumpsys vibrator_manager | grep -c "opPkg=$pkg" || true)
echo "| $name | $([ "${players:-0}" -gt 0 ] && echo "✅ $players" || echo ❌) | $([ "${vibes:-0}" -gt 0 ] && echo "✅ $vibes" || echo ❌) |" >> "$out/summary.md"
adb uninstall "$pkg" >/dev/null 2>&1
