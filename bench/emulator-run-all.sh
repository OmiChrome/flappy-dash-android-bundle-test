#!/usr/bin/env bash
# Runs emulator-bench.sh for every line of a plan file: name|apk|how. Missing APKs are skipped.
# Usage: bench/emulator-run-all.sh plan.txt <apk-dir> <out-dir>
plan=$1; dir=$2; out=$3
mkdir -p "$out"
adb root >/dev/null 2>&1; sleep 2; adb wait-for-device
adb shell settings put system screen_off_timeout 1800000
adb shell svc power stayon true
fail=0
while IFS='|' read -r name apk how; do
  [ -z "$name" ] && continue
  if [ ! -f "$dir/$apk" ]; then echo "[$name] skipped: $apk not in release"; continue; fi
  bash "$(dirname "$0")/emulator-bench.sh" "$name" "$dir/$apk" "$how" "$out" || fail=1
done < "$plan"
exit $fail
