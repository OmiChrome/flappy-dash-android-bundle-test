import { describe, expect, mock, test } from 'bun:test';

mock.module('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));

const { MAX_RUNS, defaults, sanitize, sortRuns, withRun } = await import('./store');

const run = (score: number, at: number) => ({ score, stars: 0, name: 'A', skin: 'puff', at });

describe('leaderboard store', () => {
  test('runs sort by score, ties keep the earlier run first', () => {
    const r = sortRuns([run(3, 2), run(9, 5), run(3, 1)]);
    expect(r.map((x) => [x.score, x.at])).toEqual([[9, 5], [3, 1], [3, 2]]);
  });

  test('recording a run updates stats and reports rank + new best', () => {
    let d = { ...defaults };
    const a = withRun(d, run(5, 1), 10, 12);
    d = a.data;
    expect(a.result).toEqual({ rank: 1, newBest: true, prevBest: 0 });
    const b = withRun(d, run(3, 2), 4, 5);
    expect(b.result.rank).toBe(2);
    expect(b.result.newBest).toBe(false);
    expect(b.data.games).toBe(2);
    expect(b.data.totalFlaps).toBe(14);
    expect(b.data.best).toBe(5);
  });

  test('zero-score runs count as games but do not clutter the board', () => {
    const r = withRun({ ...defaults }, run(0, 1), 1, 1);
    expect(r.data.runs.length).toBe(0);
    expect(r.data.games).toBe(1);
    expect(r.result.rank).toBeNull();
  });

  test('board is capped and drops the lowest runs', () => {
    let d = { ...defaults };
    for (let i = 1; i <= MAX_RUNS + 5; i++) d = withRun(d, run(i, i), 0, 0).data;
    expect(d.runs.length).toBe(MAX_RUNS);
    expect(d.runs[d.runs.length - 1].score).toBe(6);
    const low = withRun(d, run(1, 999), 0, 0);
    expect(low.result.rank).toBeNull();
  });

  test('sanitize survives garbage and old data', () => {
    expect(sanitize(null).name).toBe(defaults.name);
    const s = sanitize({ name: 'x'.repeat(40), best: -3, runs: [{ score: 4 }, 'junk', null], sound: false });
    expect(s.name.length).toBe(16);
    expect(s.best).toBe(0);
    expect(s.runs.length).toBe(1);
    expect(s.sound).toBe(false);
    expect(s.haptics).toBe(true);
  });
});
