#!/usr/bin/env python3
"""Turns bench-out/*.json (from emulator-bench.sh) into a Markdown table.  Usage: emulator-summary.py <dir>"""
import json, pathlib, re, sys

rows = []
for f in sorted(pathlib.Path(sys.argv[1]).glob('*.json')):
    d = json.loads(f.read_text())
    r = d.get('result', '')
    fps = re.search(r'avg ([\d.]+) fps', r)
    low = re.search(r'1% low ([\d.]+)', r)
    drop = re.search(r'dropped ([\d.]+)%', r)
    rows.append((d['name'], d.get('smoke', '?'), d.get('apkMB', 0), d.get('coldStartMs', 0), d.get('pssAvgMB', 0), d.get('cpuPct', 0),
                 fps.group(1) if fps else '–', low.group(1) if low else '–', drop.group(1) + ' %' if drop else '–'))

print('| App | Smoke test | APK (x86_64) | Cold start | RAM (PSS avg) | CPU | Avg fps | 1% low fps | Dropped frames |')
print('|---|---|---:|---:|---:|---:|---:|---:|---:|')
for n, s, a, c, p, cpu, f, l, d in sorted(rows, key=lambda x: -float(x[6]) if x[6] != '–' else 0):
    print(f"| {n} | {'✅' if s == 'ok' else '❌ ' + s} | {a} MB | {c} ms | {p} MB | {cpu} % | {f} | {l} | {d} |")
