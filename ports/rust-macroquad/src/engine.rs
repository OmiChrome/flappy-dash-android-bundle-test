//! Flappy Dash engine - port of src/game/engine.ts (see ports/SPEC.md).
use std::f32::consts::PI;

pub const WORLD_H: f32 = 640.0;
pub const FLOOR_Y: f32 = 548.0;
pub const BIRD_R: f32 = 13.0;
const GRAVITY: f32 = 1650.0;
const FLAP_V: f32 = -455.0;
const MAX_FALL: f32 = 720.0;
pub const PILLAR_W: f32 = 66.0;
pub const CAP_W: f32 = 80.0;
pub const CAP_H: f32 = 26.0;
const SPACING: f32 = 228.0;
const BASE_SPEED: f32 = 150.0;
const MAX_SPEED: f32 = 205.0;
const BASE_GAP: f32 = 184.0;
const MIN_GAP: f32 = 150.0;
const EDGE: f32 = 58.0;
const MAX_SHIFT: f32 = 165.0;
const STEP: f32 = 1.0 / 120.0;
pub const PILLARS: usize = 6;
pub const PARTICLES: usize = 64;
pub const THEMES: usize = 4;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Phase { Ready, Playing, Dead }

pub const P_FLUFF: u8 = 0;
pub const P_SPARK: u8 = 1;
pub const P_FEATHER: u8 = 2;

#[derive(Clone, Copy, Default)]
pub struct Pillar { pub on: bool, pub x: f32, pub gap_y: f32, base: f32, pub gap: f32, amp: f32, freq: f32, phase: f32, passed: bool, pub star: u8, pub star_dy: f32 }

#[derive(Clone, Copy, Default)]
pub struct Particle { pub life: f32, pub max: f32, pub x: f32, pub y: f32, vx: f32, vy: f32, pub size: f32, pub kind: u8 }

pub struct Game {
    pub phase: Phase, pub width: f32, pub bird_x: f32, pub y: f32, pub vy: f32, pub rot: f32, pub time: f32, pub scroll: f32,
    speed: f32, pub score: u32, pub stars: u32, dead_for: f32, pub flap_at: f32, pub squash: f32, pub shake: f32, pub flash: f32,
    landed: bool, spawn_in: f32, last_gap: f32, spawned: u32, pub pillars: [Pillar; PILLARS], pub parts: [Particle; PARTICLES],
    p_next: usize, pub theme: usize, pub theme_from: usize, pub theme_mix: f32, acc: f32, pub seed: i32, pub bot: bool,
}

impl Game {
    pub fn new(width: f32, seed: i32) -> Self {
        Game {
            phase: Phase::Ready, width, bird_x: width * 0.3, y: WORLD_H * 0.42, vy: 0.0, rot: 0.0, time: 0.0, scroll: 0.0,
            speed: BASE_SPEED, score: 0, stars: 0, dead_for: 0.0, flap_at: -10.0, squash: 0.0, shake: 0.0, flash: 0.0,
            landed: false, spawn_in: 0.0, last_gap: -1.0, spawned: 0, pillars: [Pillar { gap: BASE_GAP, ..Default::default() }; PILLARS],
            parts: [Particle { max: 1.0, size: 1.0, ..Default::default() }; PARTICLES], p_next: 0, theme: 0, theme_from: 0,
            theme_mix: 1.0, acc: 0.0, seed, bot: false,
        }
    }

    pub fn rand(&mut self) -> f32 {
        self.seed = self.seed.wrapping_add(0x6d2b79f5);
        let mut t = self.seed;
        t = (t ^ ((t as u32) >> 15) as i32).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ ((t as u32) >> 7) as i32).wrapping_mul(t | 61));
        (((t ^ ((t as u32) >> 14) as i32) as u32) as f64 / 4294967296.0) as f32
    }

    pub fn reset(&mut self) {
        self.phase = Phase::Ready; self.y = WORLD_H * 0.42; self.vy = 0.0; self.rot = 0.0; self.speed = BASE_SPEED;
        self.score = 0; self.stars = 0; self.dead_for = 0.0; self.flap_at = -10.0; self.squash = 0.0; self.shake = 0.0;
        self.flash = 0.0; self.landed = false; self.spawn_in = 0.0; self.last_gap = -1.0; self.spawned = 0;
        self.theme_from = self.theme; self.theme = 0; self.theme_mix = if self.theme_from == 0 { 1.0 } else { 0.0 };
        for p in self.pillars.iter_mut() { p.on = false; }
    }

    pub fn set_width(&mut self, w: f32) { self.width = w; self.bird_x = w * 0.3; }

    fn difficulty(s: u32) -> f32 { (s as f32 / 45.0).min(1.0) }

    fn emit(&mut self, kind: u8, x: f32, y: f32, vx: f32, vy: f32, size: f32, life: f32) {
        let p = &mut self.parts[self.p_next];
        self.p_next = (self.p_next + 1) % PARTICLES;
        *p = Particle { kind, x, y, vx, vy, size, life, max: life };
    }

    fn puff(&mut self, n: u32, kind: u8, x: f32, y: f32, power: f32) {
        for _ in 0..n {
            let a = self.rand() * PI * 2.0;
            let v = power * (0.35 + self.rand() * 0.65);
            let size = 2.5 + self.rand() * 3.5;
            let life = 0.45 + self.rand() * 0.45;
            self.emit(kind, x, y, a.cos() * v, a.sin() * v, size, life);
        }
    }

    pub fn flap(&mut self) -> bool {
        if self.phase == Phase::Dead { return false; }
        if self.phase == Phase::Ready { self.phase = Phase::Playing; self.spawn_in = self.width * 0.55 + 60.0; }
        self.vy = FLAP_V; self.flap_at = self.time; self.squash = 1.0;
        for _ in 0..3 {
            let vx = -40.0 - self.rand() * 50.0;
            let vy = 30.0 + self.rand() * 60.0;
            let size = 2.0 + self.rand() * 2.5;
            let life = 0.35 + self.rand() * 0.2;
            let (bx, by) = (self.bird_x - 12.0, self.y + 6.0);
            self.emit(P_FLUFF, bx, by, vx, vy, size, life);
        }
        true
    }

    pub fn can_restart(&self) -> bool { self.phase == Phase::Dead && self.dead_for > 0.6 }

    fn spawn_pillar(&mut self, x: f32) {
        let Some(i) = self.pillars.iter().position(|p| !p.on) else { return };
        let d = Self::difficulty(self.score);
        let gap = BASE_GAP - (BASE_GAP - MIN_GAP) * d;
        let moving = self.spawned >= 8 && self.rand() < 0.2 + 0.4 * d;
        let amp = if moving { 22.0 + 26.0 * d } else { 0.0 };
        let lo = EDGE + gap / 2.0 + amp;
        let hi = FLOOR_Y - EDGE - gap / 2.0 - amp;
        let (mut a, mut b) = (lo, hi);
        if self.last_gap >= 0.0 {
            a = lo.max(self.last_gap - MAX_SHIFT);
            b = hi.min(self.last_gap + MAX_SHIFT);
            if a > b { a = hi.min(lo.max(self.last_gap)); b = a; }
        }
        let base = a + self.rand() * (b - a);
        let freq = 1.1 + self.rand() * 0.8;
        let phase = self.rand() * PI * 2.0;
        let star = if self.spawned >= 2 && self.rand() < 0.34 { 1 } else { 0 };
        let star_dy = (self.rand() - 0.5) * gap * 0.45;
        let gap_y = base + if amp != 0.0 { (self.time * freq + phase).sin() * amp } else { 0.0 };
        self.pillars[i] = Pillar { on: true, x, gap_y, base, gap, amp, freq, phase, passed: false, star, star_dy };
        self.last_gap = base;
        self.spawned += 1;
    }

    fn circle_rect(cx: f32, cy: f32, r: f32, l: f32, t: f32, rr: f32, b: f32) -> bool {
        let nx = cx.clamp(l, rr);
        let ny = cy.clamp(t, b);
        let (dx, dy) = (cx - nx, cy - ny);
        dx * dx + dy * dy < r * r
    }

    fn hits(&self, p: &Pillar) -> bool {
        let (top, bot, x, y, r) = (p.gap_y - p.gap / 2.0, p.gap_y + p.gap / 2.0, self.bird_x, self.y, BIRD_R);
        if x + r < p.x - CAP_W / 2.0 || x - r > p.x + CAP_W / 2.0 { return false; }
        Self::circle_rect(x, y, r, p.x - PILLAR_W / 2.0, -1000.0, p.x + PILLAR_W / 2.0, top - CAP_H)
            || Self::circle_rect(x, y, r, p.x - PILLAR_W / 2.0, bot + CAP_H, p.x + PILLAR_W / 2.0, FLOOR_Y + 100.0)
            || Self::circle_rect(x, y, r - 2.0, p.x - CAP_W / 2.0 + 3.0, top - CAP_H, p.x + CAP_W / 2.0 - 3.0, top)
            || Self::circle_rect(x, y, r - 2.0, p.x - CAP_W / 2.0 + 3.0, bot, p.x + CAP_W / 2.0 - 3.0, bot + CAP_H)
    }

    fn die(&mut self) {
        self.phase = Phase::Dead; self.dead_for = 0.0; self.shake = 1.0; self.flash = 1.0; self.vy = self.vy.min(-180.0);
        let (x, y) = (self.bird_x, self.y);
        self.puff(14, P_FEATHER, x, y, 260.0);
        self.puff(8, P_FLUFF, x, y, 160.0);
    }

    fn add_score(&mut self, n: u32) {
        let before = self.score / 10;
        self.score += n;
        self.speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * Self::difficulty(self.score);
        let after = self.score / 10;
        if after != before { self.theme_from = self.theme; self.theme = after as usize % THEMES; self.theme_mix = 0.0; }
    }

    fn autopilot(&mut self) {
        if self.phase == Phase::Ready { if self.time > 0.6 { self.flap(); } return; }
        if self.phase != Phase::Playing { return; }
        let mut target = FLOOR_Y * 0.5;
        let mut nearest = 1e9;
        for p in self.pillars.iter() {
            if p.on && p.x + CAP_W / 2.0 + BIRD_R > self.bird_x && p.x < nearest { nearest = p.x; target = p.gap_y + p.gap / 2.0 - BIRD_R - 18.0; }
        }
        if self.y > target && self.vy > 0.0 { self.flap(); }
    }

    pub fn tick(&mut self, dt: f32) {
        if self.bot { self.autopilot(); }
        self.time += dt;
        self.squash = (self.squash - dt * 5.0).max(0.0);
        self.shake = (self.shake - dt * 3.2).max(0.0);
        self.flash = (self.flash - dt * 5.0).max(0.0);
        if self.theme_mix < 1.0 { self.theme_mix = (self.theme_mix + dt / 1.4).min(1.0); }
        for p in self.parts.iter_mut() {
            if p.life <= 0.0 { continue; }
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if p.kind == P_FEATHER { p.vy += 380.0 * dt; p.vx *= 1.0 - 2.2 * dt; if p.vy > 90.0 { p.vy = 90.0; } } else { p.vx *= 1.0 - 3.0 * dt; p.vy *= 1.0 - 3.0 * dt; }
        }
        match self.phase {
            Phase::Ready => {
                self.scroll += BASE_SPEED * 0.55 * dt;
                self.y = WORLD_H * 0.42 + (self.time * 3.2).sin() * 9.0;
                self.rot = (self.time * 3.2 + 1.0).sin() * 4.0;
                return;
            }
            Phase::Dead => {
                self.dead_for += dt;
                let floor = FLOOR_Y - BIRD_R;
                if self.y < floor {
                    self.vy = (self.vy + GRAVITY * dt).min(MAX_FALL);
                    self.y = (self.y + self.vy * dt).min(floor);
                    self.rot = (self.rot + 420.0 * dt).min(100.0);
                    if self.y >= floor && !self.landed { self.landed = true; let x = self.bird_x; self.puff(8, P_FLUFF, x, floor + BIRD_R, 120.0); }
                }
                return;
            }
            Phase::Playing => {}
        }
        self.vy = (self.vy + GRAVITY * dt).min(MAX_FALL);
        self.y += self.vy * dt;
        if self.y < BIRD_R { self.y = BIRD_R; if self.vy < 0.0 { self.vy = 0.0; } }
        let target_rot = if self.vy < 0.0 { -22.0 } else { (-22.0 + (self.vy / MAX_FALL) * 120.0).min(85.0) };
        self.rot += (target_rot - self.rot) * (dt * if self.vy < 0.0 { 18.0 } else { 6.0 }).min(1.0);
        let dx = self.speed * dt;
        self.scroll += dx;
        self.spawn_in -= dx;
        if self.spawn_in <= 0.0 { let x = self.width + CAP_W; self.spawn_pillar(x); self.spawn_in += SPACING; }
        for i in 0..PILLARS {
            if !self.pillars[i].on { continue; }
            let t = self.time;
            {
                let p = &mut self.pillars[i];
                p.x -= dx;
                if p.amp != 0.0 { p.gap_y = p.base + (t * p.freq + p.phase).sin() * p.amp; }
                if p.x < -CAP_W { p.on = false; continue; }
            }
            let p = self.pillars[i];
            if p.star == 1 {
                let sy = p.gap_y + p.star_dy;
                let (ddx, ddy) = (self.bird_x - p.x, self.y - sy);
                if ddx * ddx + ddy * ddy < (BIRD_R + 12.0) * (BIRD_R + 12.0) {
                    self.pillars[i].star = 2; self.stars += 1; self.add_score(1); self.puff(10, P_SPARK, p.x, sy, 170.0);
                }
            }
            if !p.passed && p.x + PILLAR_W / 2.0 < self.bird_x - BIRD_R {
                self.pillars[i].passed = true; self.add_score(1);
                let (x, y) = (self.bird_x + 6.0, self.y - 18.0);
                self.puff(5, P_SPARK, x, y, 90.0);
            }
            if !self.bot && self.hits(&self.pillars[i]) { self.die(); return; }
        }
        if self.y + BIRD_R >= FLOOR_Y { self.y = FLOOR_Y - BIRD_R; self.die(); self.vy = 0.0; self.landed = true; }
    }

    pub fn advance(&mut self, frame_dt: f32) {
        self.acc += frame_dt.clamp(0.0, 0.1);
        while self.acc >= STEP { self.tick(STEP); self.acc -= STEP; }
    }
}

/// Frame-time stats, same definitions as src/lib/benchStats.ts.
pub fn bench_stats(times: &[f64]) -> Vec<String> {
    let t: Vec<f64> = times.iter().copied().filter(|x| x.is_finite() && *x > 0.0).collect();
    let mut s = t.clone();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let pct = |p: f64| -> f64 { if s.is_empty() { 0.0 } else { s[((p / 100.0 * s.len() as f64).ceil() as usize).clamp(1, s.len()) - 1] } };
    let total: f64 = t.iter().sum();
    let p50 = pct(50.0);
    let hz_raw = if p50 > 0.0 { 1000.0 / p50 } else { 60.0 };
    let hz = [30, 48, 50, 60, 72, 75, 90, 120, 144, 165].into_iter().min_by(|a, b| (*a as f64 - hz_raw).abs().partial_cmp(&(*b as f64 - hz_raw).abs()).unwrap()).unwrap();
    let interval = 1000.0 / hz as f64;
    let (mut dropped, mut jank) = (0i64, 0);
    for x in &t { let slots = (x / interval).round() as i64; if slots > 1 { dropped += slots - 1; } if *x > interval * 2.0 { jank += 1; } }
    let from = (s.len() as f64 * 0.99).floor() as usize;
    let slow = if s.len() > from { s[from..].iter().sum::<f64>() / (s.len() - from) as f64 } else { 0.0 };
    let avg = if total > 0.0 { t.len() as f64 * 1000.0 / total } else { 0.0 };
    let expected = t.len() as i64 + dropped;
    vec![
        "Benchmark".into(),
        format!("avg {:.1} fps | 1% low {:.0} | dropped {:.1}%", avg, if slow > 0.0 { 1000.0 / slow } else { 0.0 }, if expected > 0 { dropped as f64 * 100.0 / expected as f64 } else { 0.0 }),
        format!("display ~{} Hz | {} frames in {:.1} s", hz, t.len(), total / 1000.0),
        format!("p50 {:.1} | p95 {:.1} | p99 {:.1} | max {:.1} ms", p50, pct(95.0), pct(99.0), s.last().copied().unwrap_or(0.0)),
        format!("dropped {} | janky {}", dropped, jank),
        "Rust + macroquad | tap to close".into(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parity_with_typescript_engine() {
        // reference values from src/game/engine.ts, seed 1234, bot on
        let mut g = Game::new(360.0, 1234);
        g.bot = true;
        let mut got = vec![];
        for i in 0..120 * 30 { g.tick(1.0 / 120.0); if i % 1200 == 1199 { got.push((g.score, g.stars, g.spawned)); } }
        assert_eq!(got, vec![(4, 0, 6), (15, 4, 13), (23, 4, 20)]);
    }
}
