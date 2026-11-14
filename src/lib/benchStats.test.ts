import { describe, expect, test } from 'bun:test';
import { benchStats } from './benchStats';

describe('benchStats', () => {
  test('perfect 60 Hz run has no drops', () => {
    const s = benchStats(new Array(600).fill(1000 / 60));
    expect(s.refreshHz).toBe(60);
    expect(Math.round(s.avgFps)).toBe(60);
    expect(s.dropped).toBe(0);
    expect(s.jank).toBe(0);
    expect(s.seconds).toBeCloseTo(10, 5);
  });

  test('detects 120 Hz and counts dropped frames', () => {
    const t = new Array(1200).fill(1000 / 120);
    t[10] = 1000 / 120 * 3; // two frames missed
    t[20] = 1000 / 120 * 2; // one frame missed
    const s = benchStats(t);
    expect(s.refreshHz).toBe(120);
    expect(s.dropped).toBe(3);
    expect(s.jank).toBe(1);
    expect(s.worst).toBeCloseTo(25, 5);
  });

  test('1% low reflects the slowest frames', () => {
    const t = new Array(1000).fill(1000 / 60);
    for (let i = 0; i < 10; i++) t[i * 50] = 50;
    const s = benchStats(t);
    expect(Math.round(s.low1Fps)).toBe(20);
  });

  test('handles empty input', () => {
    const s = benchStats([]);
    expect(s.frames).toBe(0);
    expect(s.avgFps).toBe(0);
  });
});
