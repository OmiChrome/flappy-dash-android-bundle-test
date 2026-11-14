// Tiny persisted store: profile, settings, leaderboard and lifetime stats.
// AsyncStorage + useSyncExternalStore, no extra dependency.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type Run = { score: number; stars: number; name: string; skin: string; at: number };

export type Data = {
  name: string;
  skin: string;
  sound: boolean;
  haptics: boolean;
  showFps: boolean;
  runs: Run[]; // top runs, best first
  best: number;
  games: number;
  totalScore: number;
  totalStars: number;
  totalFlaps: number;
  playSeconds: number;
};

export const MAX_RUNS = 25;
const KEY = 'flappydash.v2';

export const defaults: Data = {
  name: 'Puff Pilot',
  skin: 'puff',
  sound: true,
  haptics: true,
  showFps: false,
  runs: [],
  best: 0,
  games: 0,
  totalScore: 0,
  totalStars: 0,
  totalFlaps: 0,
  playSeconds: 0,
};

let data: Data = defaults;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, 150);
}

export async function loadStore(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) data = sanitize(JSON.parse(raw));
  } catch {
    data = defaults;
  }
  loaded = true;
  emit();
}

export function sanitize(v: unknown): Data {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Data>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  const runs = Array.isArray(o.runs)
    ? o.runs
        .filter((r): r is Run => !!r && typeof r === 'object' && typeof (r as Run).score === 'number')
        .map((r) => ({ score: num(r.score), stars: num(r.stars), name: String(r.name ?? defaults.name).slice(0, 16), skin: String(r.skin ?? 'puff'), at: num(r.at) }))
    : [];
  return {
    ...defaults,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.slice(0, 16) : defaults.name,
    skin: typeof o.skin === 'string' ? o.skin : defaults.skin,
    sound: o.sound !== false,
    haptics: o.haptics !== false,
    showFps: o.showFps === true,
    runs: sortRuns(runs).slice(0, MAX_RUNS),
    best: num(o.best),
    games: num(o.games),
    totalScore: num(o.totalScore),
    totalStars: num(o.totalStars),
    totalFlaps: num(o.totalFlaps),
    playSeconds: num(o.playSeconds),
  };
}

export function sortRuns(runs: Run[]): Run[] {
  // higher score first; ties go to the earlier run (it got there first)
  return [...runs].sort((a, b) => b.score - a.score || a.at - b.at);
}

export function getData(): Data {
  return data;
}

export function update(patch: Partial<Data>): void {
  data = { ...data, ...patch };
  emit();
  save();
}

export type RunResult = { rank: number | null; newBest: boolean; prevBest: number };

/** Pure: adds a run to the data and returns the new data and where it placed. */
export function withRun(d: Data, run: Run, flaps: number, seconds: number): { data: Data; result: RunResult } {
  const prevBest = d.best;
  const runs = run.score > 0 ? sortRuns([...d.runs, run]).slice(0, MAX_RUNS) : d.runs;
  const idx = runs.indexOf(run);
  return {
    data: {
      ...d,
      runs,
      best: Math.max(d.best, run.score),
      games: d.games + 1,
      totalScore: d.totalScore + run.score,
      totalStars: d.totalStars + run.stars,
      totalFlaps: d.totalFlaps + flaps,
      playSeconds: d.playSeconds + seconds,
    },
    result: { rank: idx >= 0 ? idx + 1 : null, newBest: run.score > prevBest, prevBest },
  };
}

export function recordRun(score: number, stars: number, flaps: number, seconds: number): RunResult {
  const run: Run = { score, stars, name: data.name, skin: data.skin, at: Date.now() };
  const r = withRun(data, run, flaps, seconds);
  data = r.data;
  emit();
  save();
  return r.result;
}

export function resetAll(): void {
  data = { ...defaults, name: data.name };
  emit();
  save();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useData(): Data {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded, () => loaded);
}
