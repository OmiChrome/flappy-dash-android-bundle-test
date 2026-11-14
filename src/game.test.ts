import { describe, expect, test } from 'bun:test';
import {
  BIRD_R, FLAP_V, GROUND_H, PIPE_GAP, PIPE_SPACING, WORLD_H,
  canRestart, createState, flap, medalFor, resetState, step,
} from './game';

const W = 360;
const rng = () => 0.5;

describe('game logic', () => {
  test('starts in ready phase and bobs without dying', () => {
    const s = createState(W);
    for (let i = 0; i < 600; i++) step(s, 1 / 60, rng);
    expect(s.phase).toBe('ready');
    expect(s.pipes.length).toBe(0);
  });

  test('first tap starts game and applies flap velocity', () => {
    const s = createState(W);
    expect(flap(s)).toBe(true);
    expect(s.phase).toBe('playing');
    expect(s.vy).toBe(FLAP_V);
    expect(s.pipes.length).toBe(1);
  });

  test('gravity pulls bird down and it dies on the ground', () => {
    const s = createState(W);
    flap(s);
    let died = false;
    for (let i = 0; i < 600 && !died; i++) died = step(s, 1 / 60, rng).died;
    expect(died).toBe(true);
    expect(s.phase).toBe('dead');
    expect(s.y).toBeCloseTo(WORLD_H - GROUND_H - BIRD_R, 1);
  });

  test('dies when flying into the ceiling', () => {
    const s = createState(W);
    flap(s);
    let died = false;
    for (let i = 0; i < 300 && !died; i++) {
      s.vy = FLAP_V; // hold flapping upward
      died = step(s, 1 / 60, rng).died;
    }
    expect(died).toBe(true);
  });

  test('a perfect autopilot scores and never collides', () => {
    const s = createState(W);
    flap(s);
    let score = 0;
    for (let i = 0; i < 60 * 90; i++) {
      const target = s.pipes.find((p) => p.x + 32 > s.birdX - BIRD_R);
      const goal = target ? target.gapY + 25 : WORLD_H * 0.4;
      if (s.y > goal && s.vy > -100) flap(s);
      const ev = step(s, 1 / 60, Math.random);
      if (ev.scored) score++;
      expect(s.phase).toBe('playing');
    }
    expect(score).toBeGreaterThan(15);
    expect(s.score).toBe(score);
  });

  test('pipe spacing is respected and gaps stay reachable', () => {
    const s = createState(W);
    flap(s);
    for (let i = 0; i < 60 * 20; i++) {
      s.y = WORLD_H / 2; s.vy = 0; // keep bird alive
      step(s, 1 / 60, Math.random);
      s.phase = 'playing';
    }
    for (let i = 1; i < s.pipes.length; i++) {
      expect(Math.abs(s.pipes[i].x - s.pipes[i - 1].x - PIPE_SPACING)).toBeLessThan(2);
      expect(Math.abs(s.pipes[i].gapY - s.pipes[i - 1].gapY)).toBeLessThanOrEqual(150.001);
    }
    for (const p of s.pipes) {
      expect(p.gapY - PIPE_GAP / 2).toBeGreaterThan(0);
      expect(p.gapY + PIPE_GAP / 2).toBeLessThan(WORLD_H - GROUND_H);
    }
  });

  test('hitting a pipe kills, restart only allowed after delay, reset works', () => {
    const s = createState(W);
    flap(s);
    s.pipes[0].x = s.birdX;
    s.pipes[0].gapY = 500;
    s.y = 100;
    s.vy = 0;
    expect(step(s, 1 / 60, rng).died).toBe(true);
    expect(canRestart(s)).toBe(false);
    for (let i = 0; i < 60; i++) step(s, 1 / 60, rng);
    expect(canRestart(s)).toBe(true);
    expect(flap(s)).toBe(false);
    resetState(s);
    expect(s.phase).toBe('ready');
    expect(s.score).toBe(0);
  });

  test('medals', () => {
    expect([0, 10, 20, 30, 40].map(medalFor)).toEqual(['none', 'bronze', 'silver', 'gold', 'platinum']);
  });

  test('large dt is clamped (no tunneling after a lag spike)', () => {
    const s = createState(W);
    flap(s);
    step(s, 5, rng);
    expect(s.y).toBeLessThan(WORLD_H);
  });
});
