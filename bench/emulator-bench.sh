#!/usr/bin/env bash
# Smoke test + benchmark one APK on a running emulator/phone (used by .github/workflows/android-test.yml).
#
#   bench/emulator-bench.sh <name> <apk> <how-to-start-benchmark> [out-dir]
#
# how-to-start-benchmark:
#   link:<uri>        open a deep link            (Expo: flappydash:///bench)
#   tap:<text>[,<text>][;<y>]  tap buttons by their text (from the accessibility tree); optional fallback height
#   at:<y-fraction>   tap the screen centre at this height (apps without accessibility, e.g. Rust)
#
# Writes <out>/<name>.json and screenshots. Words used:
#   cold start = time from "launch" until the first frame is drawn
#   PSS        = the app's fair share of RAM (shared libraries split between apps)
#   CPU %      = share of one CPU core (100 = one full core)
set -u
name=$1; apk=$2; how=$3; out=${4:-bench-out}
mkdir -p "$out"
ADB=${ADB:-adb}
log() { echo "[$name] $*"; }

pkg=$(aapt2 dump packagename "$apk" 2>/dev/null || "$ANDROID_HOME"/build-tools/*/aapt2 dump packagename "$apk" 2>/dev/null | head -1)
[ -z "$pkg" ] && pkg=$(unzip -p "$apk" AndroidManifest.xml | strings | grep -m1 -oE 'com\.flappydash\.[a-z_]+')
log "package $pkg"
$ADB uninstall "$pkg" >/dev/null 2>&1
$ADB install -r -g "$apk" >/dev/null || { log "install failed"; echo "{\"name\":\"$name\",\"smoke\":\"install-failed\"}" > "$out/$name.json"; exit 1; }
size_kb=$($ADB shell "du -sk \$(dirname \$(pm path $pkg | head -1 | cut -d: -f2))" | awk '{print $1}')
act=$($ADB shell cmd package resolve-activity --brief "$pkg" | tail -1 | tr -d '\r')

# --- cold start: median of 3
starts=()
for i in 1 2 3; do
  $ADB shell am force-stop "$pkg"; sleep 2
  t=$($ADB shell am start -W -n "$act" | grep -oE 'TotalTime: [0-9]+' | grep -oE '[0-9]+')
  starts+=("${t:-0}")
done
cold=$(printf '%s\n' "${starts[@]}" | sort -n | sed -n 2p)
log "cold start ${starts[*]} -> $cold ms"

# --- smoke: still alive after 6 s, no crash in logcat
$ADB logcat -c
sleep 6
pid=$($ADB shell pidof "$pkg" | tr -d '\r')
$ADB exec-out screencap -p > "$out/$name-start.png"
smoke=ok
[ -z "$pid" ] && smoke=crashed
$ADB logcat -d | grep -qE "FATAL EXCEPTION|Fatal signal|has died" && smoke=crashed
log "smoke $smoke (pid ${pid:-none})"

# --- start the benchmark
read -r W H < <($ADB shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')
tap_text() {
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$($ADB shell cat /sdcard/ui.xml | tr '>' '\n' | grep -iE "(text|content-desc)=\"[^\"]*$1" | head -1 | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+' | tr '\n' ' ')
  if [ -n "$b" ]; then set -- $b; $ADB shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 )); return 0; fi
  return 1
}
case "$how" in
  link:*) $ADB shell am start -a android.intent.action.VIEW -d "${how#link:}" "$pkg" >/dev/null ;;
  tap:*) spec=${how#tap:}; fallback=""; [[ "$spec" == *";"* ]] && { fallback=${spec#*;}; spec=${spec%%;*}; }
         IFS=, read -ra steps <<< "$spec"
         for s in "${steps[@]}"; do
           if ! tap_text "$s"; then
             log "button '$s' not found"
             [ -n "$fallback" ] && $ADB shell input tap $((W / 2)) "$(python3 -c "print(int($H * $fallback))")"
           fi
           sleep 2
         done ;;
  at:*) $ADB shell input tap $((W / 2)) "$(python3 -c "print(int($H * ${how#at:}))")" ;;
esac
log "benchmark started ($how)"

# --- sample RAM + CPU while it runs, wait for the RESULT line (max 100 s)
pid=$($ADB shell pidof "$pkg" | tr -d '\r')
hz=100
ticks0=$($ADB shell cat /proc/"$pid"/stat 2>/dev/null | awk '{print $14+$15}'); t0=$(date +%s.%N)
pss=(); result=""
for i in $(seq 1 50); do
  sleep 2
  p=$($ADB shell dumpsys meminfo "$pkg" | grep -m1 -E 'TOTAL PSS:|TOTAL:' | grep -oE '[0-9]+' | head -1)
  [ -n "$p" ] && pss+=("$p")
  [ "$i" = 10 ] && $ADB exec-out screencap -p > "$out/$name-bench.png"
  result=$($ADB logcat -d | grep -m1 -oE 'RESULT framework=.*' | tr -d '\r')
  [ -n "$result" ] && break
done
ticks1=$($ADB shell cat /proc/"$pid"/stat 2>/dev/null | awk '{print $14+$15}'); t1=$(date +%s.%N)
cpu=$(python3 -c "print(round((${ticks1:-0}-${ticks0:-0})/$hz/($t1-$t0)*100,1))" 2>/dev/null || echo 0)
$ADB exec-out screencap -p > "$out/$name-end.png"
$ADB logcat -d > "$out/$name-logcat.txt"
read -r pss_avg pss_max < <(printf '%s\n' "${pss[@]:-0}" | awk '{s+=$1; if($1>m)m=$1} END{printf "%d %d\n", s/NR/1024, m/1024}')
apk_mb=$(python3 -c "import os;print(round(os.path.getsize('$apk')/1048576,2))")
log "PSS avg ${pss_avg} MB max ${pss_max} MB, CPU ${cpu}%, result: ${result:-none}"
cat > "$out/$name.json" <<JSON
{"name":"$name","package":"$pkg","smoke":"$smoke","apkMB":$apk_mb,"installedKB":${size_kb:-0},"coldStartMs":${cold:-0},"pssAvgMB":${pss_avg:-0},"pssMaxMB":${pss_max:-0},"cpuPct":${cpu:-0},"result":"${result//\"/}"}
JSON
$ADB shell am force-stop "$pkg"
[ "$smoke" = ok ]
