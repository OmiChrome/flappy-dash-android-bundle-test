#!/usr/bin/env bash
# Runs emulator-bench.sh for every line of a plan file: name|apk|how. Missing APKs are skipped.
# Usage: bench/emulator-run-all.sh plan.txt <apk-dir> <out-dir>
plan=$1; dir=$2; out=$3
mkdir -p "$out"
adb root >/dev/null 2>&1; sleep 2; adb wait-for-device
adb shell settings put system screen_off_timeout 1800000
adb shell svc power stayon true
# hide crash / "isn't responding" dialogs from other apps (the emulator's launcher can freeze under load)
adb shell settings put global hide_error_dialogs 1
adb shell settings put global anr_show_background 0
fail=0
# read the plan on fd 3: adb would otherwise swallow the loop's stdin after the first app
while IFS='|' read -r name apk how <&3; do
  [ -z "$name" ] && continue
  if [ ! -f "$dir/$apk" ]; then echo "[$name] skipped: $apk not in release"; continue; fi
  adb uninstall "com.flappydash.$name" >/dev/null 2>&1 < /dev/null
  for p in $(adb shell pm list packages -3 < /dev/null | tr -d '\r' | grep -oE 'com\.flappydash\.[a-z_]+'); do adb uninstall "$p" >/dev/null < /dev/null; done
  bash "$(dirname "$0")/emulator-bench.sh" "$name" "$dir/$apk" "$how" "$out" < /dev/null || fail=1
done 3< "$plan"
exit $fail
