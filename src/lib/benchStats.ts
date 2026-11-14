// Frame-time statistics for benchmark runs. The same definitions will be used by every
// framework port, so results are comparable.

export type BenchStats = {
  frames: number;
  seconds: number;
  avgFps: number;
  refreshHz: number; // estimated display refresh rate (from the median frame)
  p50: number; // frame time percentiles, ms
  p95: number;
  p99: number;
  worst: number;
  low1Fps: number; // "1% low": fps of the slowest 1% of frames
  dropped: number; // frames the display wanted but we missed
  droppedPct: number;
  jank: number; // frames longer than 2x the refresh interval
};

const COMMON_HZ = [30, 48, 50, 60, 72, 75, 90, 120, 144, 165];

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

export function benchStats(frameMs: number[]): BenchStats {
  const t = frameMs.filter((x) => Number.isFinite(x) && x > 0);
  const sorted = [...t].sort((a, b) => a - b);
  const total = t.reduce((a, b) => a + b, 0);
  const p50 = pct(sorted, 50);
  const hzRaw = p50 > 0 ? 1000 / p50 : 60;
  const refreshHz = COMMON_HZ.reduce((best, hz) => (Math.abs(hz - hzRaw) < Math.abs(best - hzRaw) ? hz : best), 60);
  const interval = 1000 / refreshHz;
  let dropped = 0;
  let jank = 0;
  for (const x of t) {
    const slots = Math.round(x / interval);
    if (slots > 1) dropped += slots - 1;
    if (x > interval * 2) jank++;
  }
  const slowest = sorted.slice(Math.floor(sorted.length * 0.99));
  const slowAvg = slowest.length ? slowest.reduce((a, b) => a + b, 0) / slowest.length : 0;
  const expected = t.length + dropped;
  return {
    frames: t.length,
    seconds: total / 1000,
    avgFps: total > 0 ? (t.length * 1000) / total : 0,
    refreshHz,
    p50,
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    worst: sorted[sorted.length - 1] ?? 0,
    low1Fps: slowAvg > 0 ? 1000 / slowAvg : 0,
    dropped,
    droppedPct: expected ? (dropped / expected) * 100 : 0,
    jank,
  };
}

export function formatBench(s: BenchStats, extra: Record<string, string | number>): string {
  const f = (n: number, d = 1) => n.toFixed(d);
  const lines = [
    'Flappy Dash benchmark',
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    `duration: ${f(s.seconds)} s, frames: ${s.frames}, display: ~${s.refreshHz} Hz`,
    `avg fps: ${f(s.avgFps)}, 1% low: ${f(s.low1Fps)} fps`,
    `frame ms p50/p95/p99/max: ${f(s.p50)} / ${f(s.p95)} / ${f(s.p99)} / ${f(s.worst)}`,
    `dropped frames: ${s.dropped} (${f(s.droppedPct)}%), janky frames (>2x): ${s.jank}`,
  ];
  return lines.join('\n');
}
