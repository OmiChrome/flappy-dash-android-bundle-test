#!/usr/bin/env bash
# Runs audio-probe.sh for every line of a plan: name|apk|package|text to tap first. Missing APKs are skipped.
# Usage: bench/audio-probe-all.sh <plan> <apk-dir> <out-dir>
plan=$1; dir=$2; out=$3
mkdir -p "$out"
while IFS='|' read -r n a p s <&3; do
  [ -z "$n" ] && continue
  if [ -f "$dir/$a" ]; then bash "$(dirname "$0")/audio-probe.sh" "$n" "$dir/$a" "$p" "$out" "$s" < /dev/null; else echo "[$n] skipped: $a not in release"; fi
done 3< "$plan"
