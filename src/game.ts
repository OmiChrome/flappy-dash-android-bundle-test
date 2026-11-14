// Pure game logic — no React, no rendering. Fully unit-testable.
export const WORLD_H = 640;
export const GROUND_H = 96;
export const PIPE_W = 64;
export const PIPE_GAP = 178;
export const PIPE_SPACING = 215; // horizontal distance between pipes
export const PIPE_SPEED = 160;
export const GRAVITY = 1700;
export const FLAP_V = -470;
export const MAX_FALL = 760;
export const BIRD_R = 14; // collision radius
export const BIRD_X_RATIO = 0.3;
const MARGIN = 70; // min distance of gap edge from ceiling / ground
const MAX_GAP_SHIFT = 150;

export type Phase = 'ready' | 'playing' | 'dead';
export type Pipe = { x: number; gapY: number; passed: boolean };
export type Rng = () => number;

export type GameState = {
  phase: Phase;
  width: number;
  birdX: number;
  y: number;
  vy: number;
  pipes: Pipe[];
  score: number;
  time: number; // seconds since start (drives animations)
  scroll: number; // total distance scrolled (ground / parallax)
  deadFor: number; // seconds since death
  flapAt: number; // time of last flap (wing animation)
  newBest: boolean;
};

export function createState(width: number): GameState {
  return {
    phase: 'ready',
    width,
    birdX: width * BIRD_X_RATIO,
    y: WORLD_H * 0.42,
    vy: 0,
    pipes: [],
    score: 0,
    time: 0,
    scroll: 0,
    deadFor: 0,
    flapAt: -10,
    newBest: false,
  };
}

export function resetState(s: GameState): void {
  Object.assign(s, createState(s.width));
}

function nextGapY(prev: number | null, rng: Rng): number {
  const lo = MARGIN + PIPE_GAP / 2;
  const hi = WORLD_H - GROUND_H - MARGIN - PIPE_GAP / 2;
  let a = lo;
  let b = hi;
  if (prev !== null) {
    a = Math.max(lo, prev - MAX_GAP_SHIFT);
    b = Math.min(hi, prev + MAX_GAP_SHIFT);
  }
  return a + rng() * (b - a);
}

/** Tap / space / click. Returns true if this input should trigger flap feedback. */
export function flap(s: GameState): boolean {
  if (s.phase === 'dead') return false;
  if (s.phase === 'ready') {
    s.phase = 'playing';
    s.pipes = [{ x: s.width + 120, gapY: nextGapY(null, Math.random), passed: false }];
  }
  s.vy = FLAP_V;
  s.flapAt = s.time;
  return true;
}

export function canRestart(s: GameState): boolean {
  return s.phase === 'dead' && s.deadFor > 0.45;
}

function hitsPipe(s: GameState, p: Pipe): boolean {
  const left = p.x - PIPE_W / 2;
  const right = p.x + PIPE_W / 2;
  if (s.birdX + BIRD_R <= left || s.birdX - BIRD_R >= right) return false;
  const top = p.gapY - PIPE_GAP / 2;
  const bottom = p.gapY + PIPE_GAP / 2;
  return s.y - BIRD_R < top || s.y + BIRD_R > bottom;
}

/** Advance the simulation. Returns events that happened this step. */
export function step(s: GameState, dtRaw: number, rng: Rng = Math.random) {
  const dt = Math.min(dtRaw, 1 / 30);
  const events = { scored: false, died: false };
  s.time += dt;

  if (s.phase === 'ready') {
    s.scroll += PIPE_SPEED * dt * 0.6;
    s.y = WORLD_H * 0.42 + Math.sin(s.time * 4) * 8;
    return events;
  }

  if (s.phase === 'dead') {
    s.deadFor += dt;
    const floor = WORLD_H - GROUND_H - BIRD_R;
    if (s.y < floor) {
      s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
      s.y = Math.min(s.y + s.vy * dt, floor);
    }
    return events;
  }

  // playing
  s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
  s.y += s.vy * dt;
  s.scroll += PIPE_SPEED * dt;

  for (const p of s.pipes) p.x -= PIPE_SPEED * dt;
  s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);

  const last = s.pipes[s.pipes.length - 1];
  if (!last || last.x <= s.width + PIPE_W - PIPE_SPACING + 0) {
    const x = last ? last.x + PIPE_SPACING : s.width + PIPE_W;
    s.pipes.push({ x, gapY: nextGapY(last ? last.gapY : null, rng), passed: false });
  }

  for (const p of s.pipes) {
    if (!p.passed && p.x + PIPE_W / 2 < s.birdX - BIRD_R) {
      p.passed = true;
      s.score += 1;
      events.scored = true;
    }
  }

  const hitGround = s.y + BIRD_R >= WORLD_H - GROUND_H;
  const hitCeiling = s.y - BIRD_R < -40;
  if (hitGround || hitCeiling || s.pipes.some((p) => hitsPipe(s, p))) {
    s.phase = 'dead';
    s.deadFor = 0;
    s.vy = hitGround ? 0 : Math.max(s.vy, 0);
    if (hitGround) s.y = WORLD_H - GROUND_H - BIRD_R;
    events.died = true;
  }
  return events;
}

export function medalFor(score: number): 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 40) return 'platinum';
  if (score >= 30) return 'gold';
  if (score >= 20) return 'silver';
  if (score >= 10) return 'bronze';
  return 'none';
}
