//! Flappy Dash engine exposed to Kotlin/Swift through UniFFI (generated bindings).
//! The Kotlin app calls `advance()` and `frame()` every frame; `frame()` returns the shared
//! draw list, so each frame crosses the Rust<->Kotlin boundary once with ~300 shapes.
use flappy_core::draw::{draw_list, Prim};
use flappy_core::{bench_stats, report, Game, Phase};
use std::sync::Mutex;

uniffi::setup_scaffolding!();

#[derive(uniffi::Record)]
pub struct Shape { pub round: bool, pub x: f32, pub y: f32, pub w: f32, pub h: f32, pub color: u32, pub alpha: f32 }

#[derive(uniffi::Record)]
pub struct Frame { pub shapes: Vec<Shape>, pub phase: u8, pub score: u32, pub bench_on: bool, pub bench_left: i32, pub result: Option<Vec<String>>, pub best: u32,
    /// sound/vibration events of this frame (flappy_core::EV_* bits); 0 during the benchmark
    pub events: u8 }

struct Inner { game: Game, prims: Vec<Prim>, bench_on: bool, bench_ms: f64, times: Vec<f64>, result: Option<Vec<String>>, best: u32 }

#[derive(uniffi::Object)]
pub struct Engine(Mutex<Inner>);

#[uniffi::export]
impl Engine {
    #[uniffi::constructor]
    pub fn new(seed: i32) -> Self {
        Engine(Mutex::new(Inner { game: Game::new(360.0, seed), prims: Vec::with_capacity(900), bench_on: false, bench_ms: 0.0, times: Vec::with_capacity(10000), result: None, best: 0 }))
    }

    pub fn tap(&self) {
        let mut s = self.0.lock().unwrap();
        if s.result.is_some() { s.result = None; return; }
        if s.bench_on { return; }
        if s.game.phase == Phase::Dead { if s.game.can_restart() { s.game.reset(); } } else { s.game.flap(); }
    }

    pub fn start_bench(&self) {
        let mut s = self.0.lock().unwrap();
        s.times.clear();
        s.game.reset();
        s.game.seed = 1234;
        s.game.time = 0.0;
        s.game.bot = true;
        s.bench_ms = 0.0;
        s.bench_on = true;
    }

    /// Advance by `dt_ms` and return everything the UI needs to draw this frame.
    pub fn frame(&self, dt_ms: f64, world_w: f32) -> Frame {
        let mut guard = self.0.lock().unwrap();
        let s = &mut *guard;
        s.game.set_width(world_w);
        let before = s.game.phase;
        s.game.advance((dt_ms / 1000.0) as f32);
        if s.bench_on && dt_ms > 0.0 {
            s.times.push(dt_ms);
            s.bench_ms += dt_ms;
            if s.bench_ms >= 60000.0 {
                s.bench_on = false;
                let mut lines = bench_stats(&s.times);
                report("uniffi", &lines);
                if let Some(l) = lines.last_mut() { *l = "UniFFI (Rust + Kotlin) | tap to close".into(); }
                s.result = Some(lines);
                s.game.bot = false;
                s.game.reset();
            }
        }
        if before != Phase::Dead && s.game.phase == Phase::Dead && !s.game.bot && s.game.score > s.best { s.best = s.game.score; }
        let ev = s.game.take_events();
        let events = if s.bench_on || s.game.bot { 0 } else { ev };
        draw_list(&s.game, world_w, &mut s.prims);
        Frame {
            events,
            shapes: s.prims.iter().map(|p| Shape { round: p.kind == 0, x: p.x, y: p.y, w: p.w, h: p.h, color: p.color, alpha: p.alpha }).collect(),
            phase: match s.game.phase { Phase::Ready => 0, Phase::Playing => 1, Phase::Dead => 2 },
            score: s.game.score,
            bench_on: s.bench_on,
            bench_left: 60 - (s.bench_ms / 1000.0) as i32,
            result: s.result.clone(),
            best: s.best,
        }
    }
}
