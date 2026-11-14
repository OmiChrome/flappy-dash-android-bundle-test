import { describe, expect, test } from 'bun:test';
import {
  BIRD_R, DEAD, EV_FLAP, EV_HIT, EV_SCORE, FLAP_V, FLOOR_Y, MIN_GAP, BASE_GAP, PARTICLES, PILLARS, PLAYING, READY, STEP,
  advance, canRestart, createState, flap, gapFor, hitsPillar, resetState, ribbonFor, speedFor, takeEvents, tick,
  type GameState,
} from './engine';

const W = 360;

/** Autopilot: flap whenever the bird drops below the next gap centre. */
function autopilot(s: GameState) {
  let target = FLOOR_Y * 0.45;
  let best = Infinity;
  for (const p of s.pillars) {
    if (p.on && p.x + 40 > s.birdX && p.x < best) {
      best = p.x;
      target = p.gapY + 16;
    }
  }
  if (s.y > target && s.vy > -50) flap(s);
}

describe('engine', () => {
  test('ready phase bobs forever without pillars or death', () => {
    const s = createState(W, 1);
    advance(s, 0);
    for (let i = 0; i < 1200; i++) tick(s, STEP);
    expect(s.phase).toBe(READY);
    expect(s.pillars.some((p) => p.on)).toBe(false);
  });

  test('first flap starts the game with an upward velocity and an event', () => {
    const s = createState(W, 1);
    expect(flap(s)).toBe(true);
    expect(s.phase).toBe(PLAYING);
    expect(s.vy).toBe(FLAP_V);
    expect(takeEvents(s) & EV_FLAP).toBeTruthy();
    expect(takeEvents(s)).toBe(0);
  });

  test('falling without flapping hits the floor and dies', () => {
    const s = createState(W, 1);
    flap(s);
    for (let i = 0; i < 400 && s.phase !== DEAD; i++) tick(s, STEP);
    expect(s.phase).toBe(DEAD);
    expect(s.y).toBeCloseTo(FLOOR_Y - BIRD_R, 5);
    expect(takeEvents(s) & EV_HIT).toBeTruthy();
  });

  test('cannot restart instantly after dying, can after a moment', () => {
    const s = createState(W, 1);
    flap(s);
    while (s.phase !== DEAD) tick(s, STEP);
    expect(canRestart(s)).toBe(false);
    for (let i = 0; i < 120; i++) tick(s, STEP);
    expect(canRestart(s)).toBe(true);
    resetState(s);
    expect(s.phase).toBe(READY);
    expect(s.score).toBe(0);
    expect(s.pillars.every((p) => !p.on)).toBe(true);
  });

  test('ceiling is soft: the bird is clamped, not killed', () => {
    const s = createState(W, 1);
    flap(s);
    for (let i = 0; i < 60; i++) {
      flap(s);
      tick(s, STEP);
      tick(s, STEP);
    }
    expect(s.y).toBeGreaterThanOrEqual(BIRD_R);
  });

  test('autopilot scores points and pillar pool never overflows', () => {
    const s = createState(W, 42);
    flap(s);
    let scored = 0;
    for (let i = 0; i < 120 * 60 && s.phase !== DEAD; i++) {
      autopilot(s);
      tick(s, STEP);
      if (takeEvents(s) & EV_SCORE) scored++;
      expect(s.pillars.filter((p) => p.on).length).toBeLessThanOrEqual(PILLARS);
    }
    expect(scored).toBeGreaterThan(5);
    expect(s.score).toBeGreaterThanOrEqual(scored);
  });

  test('every spawned gap fits between ceiling and floor', () => {
    const s = createState(W, 7);
    flap(s);
    for (let i = 0; i < 120 * 90 && s.phase !== DEAD; i++) {
      autopilot(s);
      tick(s, STEP);
      for (const p of s.pillars) {
        if (!p.on) continue;
        expect(p.gapY - p.gap / 2).toBeGreaterThan(0);
        expect(p.gapY + p.gap / 2).toBeLessThan(FLOOR_Y);
      }
    }
  });

  test('bird in the middle of a gap is safe, inside a pillar is not', () => {
    const s = createState(W, 1);
    const p = s.pillars[0];
    Object.assign(p, { on: true, x: s.birdX, gapY: 300, gap: 180 });
    s.y = 300;
    expect(hitsPillar(s, p)).toBe(false);
    s.y = 300 - 90 - 40;
    expect(hitsPillar(s, p)).toBe(true);
    s.y = 300 + 90 + 40;
    expect(hitsPillar(s, p)).toBe(true);
  });

  test('difficulty ramps gap and speed and then caps', () => {
    expect(gapFor(0)).toBe(BASE_GAP);
    expect(gapFor(1000)).toBe(MIN_GAP);
    expect(speedFor(20)).toBeGreaterThan(speedFor(0));
    expect(speedFor(1000)).toBe(speedFor(45));
  });

  test('fixed step: same result regardless of frame rate', () => {
    const run = (fps: number) => {
      const s = createState(W, 9);
      flap(s);
      for (let i = 0; i < fps * 2; i++) advance(s, 1 / fps);
      return s.y;
    };
    expect(Math.abs(run(60) - run(120))).toBeLessThan(1);
    expect(Math.abs(run(60) - run(90))).toBeLessThan(3);
  });

  test('a long hitch is clamped instead of teleporting the bird', () => {
    const s = createState(W, 1);
    flap(s);
    const y0 = s.y;
    advance(s, 5);
    expect(s.time).toBeLessThanOrEqual(0.11);
    expect(Math.abs(s.y - y0)).toBeLessThan(100);
  });

  test('particle pool is fixed size', () => {
    const s = createState(W, 1);
    for (let i = 0; i < 200; i++) flap(s);
    expect(s.parts.length).toBe(PARTICLES);
  });

  test('ribbons', () => {
    expect(ribbonFor(9)).toBe('none');
    expect(ribbonFor(10)).toBe('sprout');
    expect(ribbonFor(20)).toBe('bloom');
    expect(ribbonFor(30)).toBe('rainbow');
    expect(ribbonFor(50)).toBe('cosmic');
  });
});

describe('benchmark autopilot', () => {
  test('bot plays a full 60 s run at rising difficulty without touching the floor', () => {
    const s = createState(W, 1234);
    s.bot = true;
    let hits = 0;
    for (let i = 0; i < 120 * 60; i++) {
      tick(s, STEP);
      if (s.phase === PLAYING) {
        for (const p of s.pillars) if (p.on && hitsPillar(s, p)) hits++;
      }
    }
    expect(s.phase).toBe(PLAYING);
    expect(s.score).toBeGreaterThan(25);
    // the bot should be clean almost always; invincibility is only a safety net
    expect(hits).toBeLessThan(30);
  });

  test('bot run is deterministic for a seed', () => {
    const run = () => {
      const s = createState(W, 99);
      s.bot = true;
      for (let i = 0; i < 120 * 20; i++) tick(s, STEP);
      return [s.score, s.stars, Math.round(s.y)];
    };
    expect(run()).toEqual(run());
  });
});
