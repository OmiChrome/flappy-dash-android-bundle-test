<#
  Flappy Dash - measure one Android build over (wireless) ADB.
  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\measure-android.ps1 -Package com.flappydash.game -Label expo-arm64
  Needs adb in PATH (or pass -Adb C:\platform-tools\adb.exe) and a connected phone (adb devices).
  Output: measurements\<Label>-<time>.csv (samples) and measurements\<Label>-<time>.txt (summary)
#>
param(
  [Parameter(Mandatory = $true)][string]$Package,
  [string]$Label = $Package,
  [int]$Seconds = 70,
  [int]$Interval = 2,
  [string]$Adb = "adb"
)

$ErrorActionPreference = "Stop"
function A([string]$cmd) { & $Adb shell $cmd 2>$null }

$dev = & $Adb devices | Select-String "device$"
if (-not $dev) { Write-Error "No device. Run: adb connect <phone-ip:port>"; exit 1 }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path measurements | Out-Null
$csv = "measurements\$Label-$stamp.csv"
$txt = "measurements\$Label-$stamp.txt"

$model = (A "getprop ro.product.model").Trim()
$android = (A "getprop ro.build.version.release").Trim()
$abi = (A "getprop ro.product.cpu.abi").Trim()

# --- size on device
$codePath = ((A "dumpsys package $Package" | Select-String "codePath=" | Select-Object -First 1) -replace ".*codePath=", "").Trim()
$codeSize = if ($codePath) { (A "du -sk $codePath").Split()[0] } else { "?" }

# --- cold start (3 runs, median)
$activity = (A "cmd package resolve-activity --brief $Package" | Select-Object -Last 1).Trim()
$starts = @()
for ($i = 0; $i -lt 3; $i++) {
  A "am force-stop $Package" | Out-Null
  Start-Sleep -Seconds 2
  $out = A "am start -W -n $activity"
  $t = ($out | Select-String "TotalTime:") -replace "\D", ""
  if ($t) { $starts += [int]$t }
}
$coldStart = if ($starts.Count) { ($starts | Sort-Object)[[math]::Floor($starts.Count / 2)] } else { "?" }

Write-Host ""
Write-Host "App is open. On the phone: Settings -> Run benchmark (60 s). Press Enter here right after starting it." -ForegroundColor Yellow
Read-Host | Out-Null

A "dumpsys gfxinfo $Package reset" | Out-Null
$appPid = (A "pidof $Package").Trim()
"time_s,pss_kb,rss_kb,cpu_pct,graphics_kb,native_kb" | Out-File -Encoding ascii $csv

$samples = @()
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  $mem = A "dumpsys meminfo $Package"
  $pss = (($mem | Select-String "TOTAL PSS:") -replace ".*TOTAL PSS:\s+(\d+).*", '$1')
  $rss = (($mem | Select-String "TOTAL RSS:") -replace ".*TOTAL RSS:\s+(\d+).*", '$1')
  $gfx = (($mem | Select-String "^\s+Graphics:") -replace "^\s+Graphics:\s+(\d+).*", '$1')
  $nat = (($mem | Select-String "^\s+Native Heap:") -replace "^\s+Native Heap:\s+(\d+).*", '$1')
  $top = A "top -b -n 1 -p $appPid" | Select-String " $appPid "
  $cpu = if ($top) { ($top.ToString().Trim() -split "\s+")[8] } else { "0" }
  $s = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
  "$s,$pss,$rss,$cpu,$gfx,$nat" | Out-File -Append -Encoding ascii $csv
  $samples += [pscustomobject]@{ pss = [double]$pss; rss = [double]$rss; cpu = [double]$cpu }
  Start-Sleep -Seconds $Interval
}

$gfxinfo = A "dumpsys gfxinfo $Package" | Select-String "Total frames|Janky frames|percentile"

$avg = { param($xs) if ($xs.Count) { [math]::Round(($xs | Measure-Object -Average).Average, 1) } else { 0 } }
$max = { param($xs) if ($xs.Count) { ($xs | Measure-Object -Maximum).Maximum } else { 0 } }

$summary = @"
Flappy Dash measurement - $Label
device: $model, Android $android, $abi
package: $Package
installed code size: $codeSize KB
cold start (median of 3): $coldStart ms   [runs: $($starts -join ', ')]
RAM PSS avg/max: $(& $avg $samples.pss) / $(& $max $samples.pss) KB
RAM RSS avg/max: $(& $avg $samples.rss) / $(& $max $samples.rss) KB
CPU avg/max: $(& $avg $samples.cpu) / $(& $max $samples.cpu) %  (100% = one core)
gfxinfo (HWUI frames only):
$($gfxinfo -join "`n")
samples: $csv
"@
$summary | Out-File -Encoding utf8 $txt
Write-Host $summary
