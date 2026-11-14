//! Flappy Dash - Crux port. Crux's "headless core" pattern (Elm architecture):
//!   Event (frame tick, tap, start benchmark) -> update(Model) -> ViewModel (shapes + HUD)
//! The core never draws; the native shell (Kotlin + Compose here) sends events and draws the
//! ViewModel. The shell talks to the core through typed UniFFI functions (instead of Crux's
//! serialized Bridge + generated types), which keeps the shell to one small Kotlin file.
use crux_core::{macros::effect, render::{self, RenderOperation}, App, Command, Core};
use flappy_core::draw::{draw_list, Prim};
use flappy_core::{bench_stats, report, Game, Phase};
use serde::{Deserialize, Serialize};

uniffi::setup_scaffolding!();

// ---------------------------------------------------------------- the Crux app
#[derive(Serialize, Deserialize, Debug)]
pub enum Event {
    Frame { dt_ms: f64, world_w: f32 },
    Tap,
    StartBench,
}

#[effect]
pub enum Effect {
    Render(RenderOperation),
}

pub struct Model {
    game: Game,
    prims: Vec<Prim>,
    bench_on: bool,
    bench_ms: f64,
    times: Vec<f64>,
    result: Option<Vec<String>>,
    best: u32,
}

impl Default for Model {
    fn default() -> Self {
        let seed = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i32).unwrap_or(1);
        Model { game: Game::new(360.0, seed), prims: Vec::with_capacity(900), bench_on: false, bench_ms: 0.0, times: Vec::with_capacity(10000), result: None, best: 0 }
    }
}

#[derive(uniffi::Record, Clone)]
pub struct Shape { pub round: bool, pub x: f32, pub y: f32, pub w: f32, pub h: f32, pub color: u32, pub alpha: f32 }

#[derive(uniffi::Record, Clone)]
pub struct ViewModel { pub shapes: Vec<Shape>, pub phase: u8, pub score: u32, pub bench_on: bool, pub bench_left: i32, pub result: Option<Vec<String>>, pub best: u32 }

#[derive(Default)]
pub struct Flappy;

impl App for Flappy {
    type Event = Event;
    type Model = Model;
    type ViewModel = ViewModel;
    type Effect = Effect;

    fn update(&self, event: Event, m: &mut Model) -> Command<Effect, Event> {
        match event {
            Event::Tap => {
                if m.result.is_some() { m.result = None; }
                else if !m.bench_on {
                    if m.game.phase == Phase::Dead { if m.game.can_restart() { m.game.reset(); } } else { m.game.flap(); }
                }
            }
            Event::StartBench => {
                m.times.clear();
                m.game.reset();
                m.game.seed = 1234;
                m.game.time = 0.0;
                m.game.bot = true;
                m.bench_ms = 0.0;
                m.bench_on = true;
            }
            Event::Frame { dt_ms, world_w } => {
                m.game.set_width(world_w);
                let before = m.game.phase;
                m.game.advance((dt_ms / 1000.0) as f32);
                if m.bench_on && dt_ms > 0.0 {
                    m.times.push(dt_ms);
                    m.bench_ms += dt_ms;
                    if m.bench_ms >= 60000.0 {
                        m.bench_on = false;
                        let mut lines = bench_stats(&m.times);
                        report("crux", &lines);
                        if let Some(l) = lines.last_mut() { *l = "Crux (Rust core + Kotlin shell) | tap to close".into(); }
                        m.result = Some(lines);
                        m.game.bot = false;
                        m.game.reset();
                    }
                }
                if before != Phase::Dead && m.game.phase == Phase::Dead && !m.game.bot && m.game.score > m.best { m.best = m.game.score; }
                let Model { game, prims, .. } = m;
                draw_list(game, world_w, prims);
            }
        }
        render::render()
    }

    fn view(&self, m: &Model) -> ViewModel {
        ViewModel {
            shapes: m.prims.iter().map(|p| Shape { round: p.kind == 0, x: p.x, y: p.y, w: p.w, h: p.h, color: p.color, alpha: p.alpha }).collect(),
            phase: match m.game.phase { Phase::Ready => 0, Phase::Playing => 1, Phase::Dead => 2 },
            score: m.game.score,
            bench_on: m.bench_on,
            bench_left: 60 - (m.bench_ms / 1000.0) as i32,
            result: m.result.clone(),
            best: m.best,
        }
    }
}

// ---------------------------------------------------------------- shell interface (UniFFI)
#[derive(uniffi::Object)]
pub struct CruxCore(Core<Flappy>);

#[uniffi::export]
impl CruxCore {
    #[uniffi::constructor]
    pub fn new() -> Self { CruxCore(Core::new()) }

    /// One frame: process the tick event, then return the view model if the core asked to render.
    pub fn frame(&self, dt_ms: f64, world_w: f32) -> Option<ViewModel> {
        let effects = self.0.process_event(Event::Frame { dt_ms, world_w });
        effects.iter().any(|e| matches!(e, Effect::Render(_))).then(|| self.0.view())
    }
    pub fn tap(&self) { let _ = self.0.process_event(Event::Tap); }
    pub fn start_bench(&self) { let _ = self.0.process_event(Event::StartBench); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn frame_renders_shapes() {
        let core = CruxCore::new();
        let vm = core.frame(16.7, 360.0).expect("render effect");
        assert!(vm.shapes.len() > 50);
        core.start_bench();
        for _ in 0..600 { core.frame(1000.0 / 60.0, 360.0); }
        let vm = core.frame(16.7, 360.0).unwrap();
        assert!(vm.bench_on && vm.score > 3, "score {}", vm.score);
    }
}
