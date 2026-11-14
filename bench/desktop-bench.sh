#!/usr/bin/env bash
# Runs a desktop build on a virtual screen (Xvfb, software OpenGL), presses its Benchmark button,
# and samples CPU and RAM for 30 s.  Usage: bench/desktop-bench.sh <name> <binary> <click-x> <click-y> [shots-dir]
# CPU% = share of one core used (100 = one full core).  RSS = RAM the process holds.
set -u
name=$1; bin=$2; cx=$3; cy=$4; shots=${5:-/tmp}
disp=:$((90 + RANDOM % 9))
Xvfb $disp -screen 0 400x820x24 >/dev/null 2>&1 & xp=$!
sleep 1
export DISPLAY=$disp LIBGL_ALWAYS_SOFTWARE=1 WINIT_UNIX_BACKEND=x11
"$bin" >/tmp/desktop-bench-$name.log 2>&1 & ap=$!
sleep 6
xdotool mousemove "$cx" "$cy" click 1
sleep 3
t0=$(awk '{print $14+$15}' /proc/$ap/stat); s0=$(date +%s.%N)
rss_max=0; rss_sum=0; n=0
for i in $(seq 1 30); do
  sleep 1
  r=$(awk '/VmRSS/{print $2}' /proc/$ap/status 2>/dev/null || echo 0)
  rss_sum=$((rss_sum + r)); n=$((n + 1)); [ "$r" -gt "$rss_max" ] && rss_max=$r
  [ "$i" = 15 ] && import -window root "$shots/desk-$name.png" 2>/dev/null
done
t1=$(awk '{print $14+$15}' /proc/$ap/stat); s1=$(date +%s.%N)
hz=$(getconf CLK_TCK)
cpu=$(python3 -c "print(round(($t1-$t0)/$hz/($s1-$s0)*100,1))")
echo "{\"name\":\"$name\",\"cpuPct\":$cpu,\"rssAvgMB\":$((rss_sum / n / 1024)),\"rssMaxMB\":$((rss_max / 1024)),\"binaryMB\":$(python3 -c "import os;print(round(os.path.getsize('$bin')/1048576,2))")}"
kill $ap $xp 2>/dev/null; wait 2>/dev/null
