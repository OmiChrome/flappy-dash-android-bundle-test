// Flappy Dash game engine.
// Pure functions over one mutable state object. Every function is a worklet so the
// whole simulation runs on the UI thread (Reanimated), and plain JS in unit tests.
// No allocation happens per frame: pillars and particles live in fixed-size pools.

export const WORLD_H = 640;
export const FLOOR_H = 92;
export const FLOOR_Y = WORLD_H - FLOOR_H;

export const BIRD_R = 13; // collision radius (drawn bird is ~18; hitbox is forgiving)
export const BIRD_X_RATIO = 0.3;
export const GRAVITY = 1650;
export const FLAP_V = -455;
export const MAX_FALL = 720;

export const PILLAR_W = 66;
export const CAP_W = 80;
export const CAP_H = 26;
export const SPACING = 228;
export const BASE_SPEED = 150;
export const MAX_SPEED = 205;
export const BASE_GAP = 184;
export const MIN_GAP = 150;
const EDGE = 58; // min distance between gap edge and ceiling / floor
const MAX_SHIFT = 165; // max gap centre change between neighbours

export const STEP = 1 / 120; // fixed simulation step, same feel on 60/90/120 Hz screens
const MAX_FRAME = 0.1;

export const PILLARS = 6;
export const PARTICLES = 64;
export const THEMES = 4;
export const POINTS_PER_THEME = 10;

export const READY = 0;
export const PLAYING = 1;
export const DEAD = 2;

// event bits, collected per frame and sent to the JS thread once
export const EV_FLAP = 1;
export const EV_SCORE = 2;
export const EV_STAR = 4;
export const EV_HIT = 8;
export const EV_LAND = 16;
export const EV_THEME = 32;

export const P_FLUFF = 0;
export const P_SPARK = 1;
export const P_FEATHER = 2;

export type Pillar = {
  on: boolean;
  x: number;
  gapY: number; // current gap centre
  base: number; // resting gap centre (moving pillars oscillate around it)
  gap: number;
  amp: number;
  freq: number;
  phase: number;
  passed: boolean;
  star: number; // 0 none, 1 present, 2 collected
  starDy: number;
};

export type Particle = {
  life: number; // seconds left, <= 0 means free
  max: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  kind: number;
};

export type GameState = {
  phase: number;
  width: number;
  birdX: number;
  y: number;
  vy: number;
  rot: number;
  time: number;
  scroll: number;
  speed: number;
  score: number;
  stars: number;
  flaps: number;
  deadFor: number;
  flapAt: number;
  squash: number;
  shake: number;
  flash: number;
  landed: boolean;
  spawnIn: number; // distance until next pillar
  lastGap: number;
  spawned: number;
  pillars: Pillar[];
  parts: Particle[];
  pNext: number;
  theme: number;
  themeFrom: number;
  themeMix: number; // 0..1 crossfade from themeFrom to theme
  acc: number;
  seed: number;
  ev: number;
  bot: boolean; // benchmark autopilot: plays itself and cannot die on pillars
};

/** Seeded RNG (mulberry32) stored in state so runs are reproducible in tests. */
export function rand(s: GameState): number {
  'worklet';
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createState(width: number, seed = Date.now() | 0): GameState {
  'worklet';
  const pillars: Pillar[] = [];
  for (let i = 0; i < PILLARS; i++) {
    pillars.push({ on: false, x: 0, gapY: 0, base: 0, gap: BASE_GAP, amp: 0, freq: 0, phase: 0, passed: false, star: 0, starDy: 0 });
  }
  const parts: Particle[] = [];
  for (let i = 0; i < PARTICLES; i++) {
    parts.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, size: 1, kind: 0 });
  }
  return {
    phase: READY,
    width,
    birdX: width * BIRD_X_RATIO,
    y: WORLD_H * 0.42,
    vy: 0,
    rot: 0,
    time: 0,
    scroll: 0,
    speed: BASE_SPEED,
    score: 0,
    stars: 0,
    flaps: 0,
    deadFor: 0,
    flapAt: -10,
    squash: 0,
    shake: 0,
    flash: 0,
    landed: false,
    spawnIn: 0,
    lastGap: -1,
    spawned: 0,
    pillars,
    parts,
    pNext: 0,
    theme: 0,
    themeFrom: 0,
    themeMix: 1,
    acc: 0,
    seed,
    ev: 0,
    bot: false,
  };
}

/** Back to the ready screen, keeping pools (no allocation) and the current width. */
export function resetState(s: GameState): void {
  'worklet';
  s.phase = READY;
  s.y = WORLD_H * 0.42;
  s.vy = 0;
  s.rot = 0;
  s.speed = BASE_SPEED;
  s.score = 0;
  s.stars = 0;
  s.flaps = 0;
  s.deadFor = 0;
  s.flapAt = -10;
  s.squash = 0;
  s.shake = 0;
  s.flash = 0;
  s.landed = false;
  s.spawnIn = 0;
  s.lastGap = -1;
  s.spawned = 0;
  s.themeFrom = s.theme;
  s.theme = 0;
  s.themeMix = s.themeFrom === 0 ? 1 : 0;
  for (let i = 0; i < PILLARS; i++) s.pillars[i].on = false;
  s.ev = 0;
}

export function setWidth(s: GameState, width: number): void {
  'worklet';
  s.width = width;
  s.birdX = width * BIRD_X_RATIO;
}

/** 0 at the start, 1 at full difficulty (score 45). */
export function difficulty(score: number): number {
  'worklet';
  return Math.min(1, score / 45);
}

export function gapFor(score: number): number {
  'worklet';
  return BASE_GAP - (BASE_GAP - MIN_GAP) * difficulty(score);
}

export function speedFor(score: number): number {
  'worklet';
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * difficulty(score);
}

export function emit(s: GameState, kind: number, x: number, y: number, vx: number, vy: number, size: number, life: number): void {
  'worklet';
  const p = s.parts[s.pNext];
  s.pNext = (s.pNext + 1) % PARTICLES;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.size = size;
  p.life = life;
  p.max = life;
}

function puff(s: GameState, n: number, kind: number, x: number, y: number, power: number): void {
  'worklet';
  for (let i = 0; i < n; i++) {
    const a = rand(s) * Math.PI * 2;
    const v = power * (0.35 + rand(s) * 0.65);
    emit(s, kind, x, y, Math.cos(a) * v, Math.sin(a) * v, 2.5 + rand(s) * 3.5, 0.45 + rand(s) * 0.45);
  }
}

/** Tap / click / space. Returns true when it caused a flap. */
export function flap(s: GameState): boolean {
  'worklet';
  if (s.phase === DEAD) return false;
  if (s.phase === READY) {
    s.phase = PLAYING;
    s.spawnIn = s.width * 0.55 + 60; // first pillar arrives after a short breather
  }
  s.vy = FLAP_V;
  s.flapAt = s.time;
  s.squash = 1;
  s.flaps += 1;
  s.ev |= EV_FLAP;
  for (let i = 0; i < 3; i++) {
    emit(s, P_FLUFF, s.birdX - 12, s.y + 6, -40 - rand(s) * 50, 30 + rand(s) * 60, 2 + rand(s) * 2.5, 0.35 + rand(s) * 0.2);
  }
  return true;
}

export function canRestart(s: GameState): boolean {
  'worklet';
  return s.phase === DEAD && s.deadFor > 0.6;
}

function spawnPillar(s: GameState, x: number): void {
  'worklet';
  let p: Pillar | null = null;
  for (let i = 0; i < PILLARS; i++) {
    if (!s.pillars[i].on) {
      p = s.pillars[i];
      break;
    }
  }
  if (!p) return;
  const gap = gapFor(s.score);
  const d = difficulty(s.score);
  const moving = s.spawned >= 8 && rand(s) < 0.2 + 0.4 * d;
  const amp = moving ? 22 + 26 * d : 0;
  const lo = EDGE + gap / 2 + amp;
  const hi = FLOOR_Y - EDGE - gap / 2 - amp;
  let a = lo;
  let b = hi;
  if (s.lastGap >= 0) {
    a = Math.max(lo, s.lastGap - MAX_SHIFT);
    b = Math.min(hi, s.lastGap + MAX_SHIFT);
    if (a > b) a = b = Math.min(hi, Math.max(lo, s.lastGap));
  }
  const base = a + rand(s) * (b - a);
  p.on = true;
  p.x = x;
  p.base = base;
  p.gap = gap;
  p.amp = amp;
  p.freq = 1.1 + rand(s) * 0.8;
  p.phase = rand(s) * Math.PI * 2;
  p.gapY = base + (amp ? Math.sin(s.time * p.freq + p.phase) * amp : 0);
  p.passed = false;
  p.star = s.spawned >= 2 && rand(s) < 0.34 ? 1 : 0;
  p.starDy = (rand(s) - 0.5) * gap * 0.45;
  s.lastGap = base;
  s.spawned += 1;
}

/** Distance from circle centre to a rect; true when the circle overlaps it. */
function circleRect(cx: number, cy: number, r: number, l: number, t: number, rr: number, b: number): boolean {
  'worklet';
  const nx = cx < l ? l : cx > rr ? rr : cx;
  const ny = cy < t ? t : cy > b ? b : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function hitsPillar(s: GameState, p: Pillar): boolean {
  'worklet';
  const top = p.gapY - p.gap / 2;
  const bot = p.gapY + p.gap / 2;
  const x = s.birdX;
  const y = s.y;
  const r = BIRD_R;
  if (x + r < p.x - CAP_W / 2 || x - r > p.x + CAP_W / 2) return false;
  // bodies
  if (circleRect(x, y, r, p.x - PILLAR_W / 2, -1000, p.x + PILLAR_W / 2, top - CAP_H)) return true;
  if (circleRect(x, y, r, p.x - PILLAR_W / 2, bot + CAP_H, p.x + PILLAR_W / 2, FLOOR_Y + 100)) return true;
  // fluffy caps (slightly inset: the round puffs have soft edges)
  if (circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, top - CAP_H, p.x + CAP_W / 2 - 3, top)) return true;
  if (circleRect(x, y, r - 2, p.x - CAP_W / 2 + 3, bot, p.x + CAP_W / 2 - 3, bot + CAP_H)) return true;
  return false;
}

function die(s: GameState): void {
  'worklet';
  s.phase = DEAD;
  s.deadFor = 0;
  s.shake = 1;
  s.flash = 1;
  s.vy = Math.min(s.vy, -180); // little bump up before falling
  s.ev |= EV_HIT;
  puff(s, 14, P_FEATHER, s.birdX, s.y, 260);
  puff(s, 8, P_FLUFF, s.birdX, s.y, 160);
}

function updateParticles(s: GameState, dt: number): void {
  'worklet';
  for (let i = 0; i < PARTICLES; i++) {
    const p = s.parts[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === P_FEATHER) {
      p.vy += 380 * dt;
      p.vx *= 1 - 2.2 * dt;
      if (p.vy > 90) p.vy = 90; // feathers drift down slowly
    } else {
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
  }
}

function addScore(s: GameState, n: number): void {
  'worklet';
  const before = Math.floor(s.score / POINTS_PER_THEME);
  s.score += n;
  s.speed = speedFor(s.score);
  const after = Math.floor(s.score / POINTS_PER_THEME);
  if (after !== before) {
    s.themeFrom = s.theme;
    s.theme = after % THEMES;
    s.themeMix = 0;
    s.ev |= EV_THEME;
  }
}

/** Autopilot used by benchmark mode: flaps whenever the bird sinks near the bottom of the next gap. */
export function autopilot(s: GameState): void {
  'worklet';
  if (s.phase === READY) {
    if (s.time > 0.6) flap(s);
    return;
  }
  if (s.phase !== PLAYING) return;
  let target = FLOOR_Y * 0.5;
  let nearest = 1e9;
  for (let i = 0; i < PILLARS; i++) {
    const p = s.pillars[i];
    if (p.on && p.x + CAP_W / 2 + BIRD_R > s.birdX && p.x < nearest) {
      nearest = p.x;
      target = p.gapY + p.gap / 2 - BIRD_R - 18;
    }
  }
  if (s.y > target && s.vy > 0) flap(s);
}

/** One fixed simulation step. */
export function tick(s: GameState, dt: number): void {
  'worklet';
  if (s.bot) autopilot(s);
  s.time += dt;
  s.squash = Math.max(0, s.squash - dt * 5);
  s.shake = Math.max(0, s.shake - dt * 3.2);
  s.flash = Math.max(0, s.flash - dt * 5);
  if (s.themeMix < 1) s.themeMix = Math.min(1, s.themeMix + dt / 1.4);
  updateParticles(s, dt);

  if (s.phase === READY) {
    s.scroll += BASE_SPEED * 0.55 * dt;
    s.y = WORLD_H * 0.42 + Math.sin(s.time * 3.2) * 9;
    s.rot = Math.sin(s.time * 3.2 + 1) * 4;
    return;
  }

  if (s.phase === DEAD) {
    s.deadFor += dt;
    const floor = FLOOR_Y - BIRD_R;
    if (s.y < floor) {
      s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
      s.y = Math.min(s.y + s.vy * dt, floor);
      s.rot = Math.min(100, s.rot + 420 * dt);
      if (s.y >= floor && !s.landed) {
        s.landed = true;
        s.ev |= EV_LAND;
        puff(s, 8, P_FLUFF, s.birdX, floor + BIRD_R, 120);
      }
    }
    return;
  }

  // playing
  s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
  s.y += s.vy * dt;
  if (s.y < BIRD_R) {
    // soft ceiling: bump instead of dying, pillars reach the top anyway
    s.y = BIRD_R;
    if (s.vy < 0) s.vy = 0;
  }
  const targetRot = s.vy < 0 ? -22 : Math.min(85, -22 + (s.vy / MAX_FALL) * 120);
  s.rot += (targetRot - s.rot) * Math.min(1, dt * (s.vy < 0 ? 18 : 6));

  const dx = s.speed * dt;
  s.scroll += dx;
  s.spawnIn -= dx;
  if (s.spawnIn <= 0) {
    spawnPillar(s, s.width + CAP_W);
    s.spawnIn += SPACING;
  }

  for (let i = 0; i < PILLARS; i++) {
    const p = s.pillars[i];
    if (!p.on) continue;
    p.x -= dx;
    if (p.amp) p.gapY = p.base + Math.sin(s.time * p.freq + p.phase) * p.amp;
    if (p.x < -CAP_W) {
      p.on = false;
      continue;
    }
    if (p.star === 1) {
      const sy = p.gapY + p.starDy;
      const ddx = s.birdX - p.x;
      const ddy = s.y - sy;
      if (ddx * ddx + ddy * ddy < (BIRD_R + 12) * (BIRD_R + 12)) {
        p.star = 2;
        s.stars += 1;
        addScore(s, 1);
        s.ev |= EV_STAR;
        puff(s, 10, P_SPARK, p.x, sy, 170);
      }
    }
    if (!p.passed && p.x + PILLAR_W / 2 < s.birdX - BIRD_R) {
      p.passed = true;
      addScore(s, 1);
      s.ev |= EV_SCORE;
      puff(s, 5, P_SPARK, s.birdX + 6, s.y - 18, 90);
    }
    if (!s.bot && hitsPillar(s, p)) {
      die(s);
      return;
    }
  }

  if (s.y + BIRD_R >= FLOOR_Y) {
    s.y = FLOOR_Y - BIRD_R;
    die(s);
    s.vy = 0;
    s.landed = true;
    s.ev |= EV_LAND;
  }
}

/** Advance by a real frame delta (seconds) using fixed steps. */
export function advance(s: GameState, frameDt: number): void {
  'worklet';
  s.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
  while (s.acc >= STEP) {
    tick(s, STEP);
    s.acc -= STEP;
  }
}

/** Pops the event bits collected since the last call. */
export function takeEvents(s: GameState): number {
  'worklet';
  const e = s.ev;
  s.ev = 0;
  return e;
}

export type Ribbon = 'none' | 'sprout' | 'bloom' | 'rainbow' | 'cosmic';
export function ribbonFor(score: number): Ribbon {
  if (score >= 50) return 'cosmic';
  if (score >= 30) return 'rainbow';
  if (score >= 20) return 'bloom';
  if (score >= 10) return 'sprout';
  return 'none';
}
