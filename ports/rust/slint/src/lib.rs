//! Flappy Dash - Slint port. The game draws the shared draw list (flappy_core::draw) as Slint
//! elements; a frame-synced `animation-tick()` drives the loop.
use flappy_core::draw::{draw_list, Prim};
use flappy_core::{bench_stats, Game, Phase, WORLD_H};
use slint::{Color, Model, VecModel};
use std::cell::RefCell;
use std::rc::Rc;

slint::slint! {
    export struct Shape { round: bool, x: length, y: length, w: length, h: length, color: color }

    export component AppWindow inherits Window {
        title: "Flappy Dash (Slint)";
        preferred-width: 400px;
        preferred-height: 820px;
        background: #C9ECFF;
        in property <[Shape]> shapes;
        in property <string> big;
        in property <string> small;
        in property <bool> show-bench-button;
        in property <string> result;
        callback frame(duration);
        callback tap();
        callback bench();

        property <duration> tick: animation-tick();
        changed tick => { root.frame(self.tick); }

        TouchArea {
            pointer-event(e) => { if (e.kind == PointerEventKind.down) { root.tap(); } }
        }
        for s in shapes: Rectangle {
            x: s.x; y: s.y; width: s.w; height: s.h;
            background: s.color;
            border-radius: s.round ? s.w / 2 : 0;
        }
        Text { y: 70px; width: parent.width; horizontal-alignment: center; text: big; font-size: 56px; font-weight: 900; color: white; }
        Text { y: 150px; width: parent.width; horizontal-alignment: center; text: small; font-size: 18px; font-weight: 700; color: white; }
        if show-bench-button: Rectangle {
            x: (parent.width - 260px) / 2; y: parent.height * 0.79; width: 260px; height: 56px;
            border-radius: 28px; background: #55BF98;
            Text { text: "Benchmark (60 s)"; color: white; font-size: 20px; font-weight: 700; }
            TouchArea { clicked => { root.bench(); } }
        }
        if result != "": Rectangle {
            x: 24px; y: parent.height * 0.25; width: parent.width - 48px; height: 220px;
            border-radius: 28px; background: white;
            Text { text: result; color: #4A3763; font-size: 14px; horizontal-alignment: center; vertical-alignment: center; wrap: word-wrap; }
            TouchArea { clicked => { root.tap(); } }
        }
    }
}

const SLOTS: usize = 900; // fixed model size: rows are updated in place every frame

struct State {
    game: Game,
    last_ms: f64,
    bench_on: bool,
    bench_ms: f64,
    times: Vec<f64>,
    result: String,
    best: u32,
    prims: Vec<Prim>,
}

fn to_shape(p: &Prim, k: f32) -> Shape {
    let c = p.color;
    let color = Color::from_argb_u8((p.alpha.clamp(0.0, 1.0) * 255.0) as u8, (c >> 16) as u8, (c >> 8) as u8, c as u8);
    if p.kind == 0 {
        Shape { round: true, x: (p.x - p.w / 2.0) * k, y: (p.y - p.h / 2.0) * k, w: p.w * k, h: p.h * k, color }
    } else {
        Shape { round: false, x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k, color }
    }
}

pub fn run() {
    let ui = AppWindow::new().unwrap();
    let blank = Shape { round: false, x: 0.0, y: 0.0, w: 0.0, h: 0.0, color: Color::from_argb_u8(0, 0, 0, 0) };
    let model = Rc::new(VecModel::from(vec![blank.clone(); SLOTS]));
    ui.set_shapes(model.clone().into());
    let seed = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i32).unwrap_or(1);
    let st = Rc::new(RefCell::new(State { game: Game::new(360.0, seed), last_ms: -1.0, bench_on: false, bench_ms: 0.0, times: Vec::with_capacity(10000), result: String::new(), best: 0, prims: Vec::with_capacity(SLOTS) }));

    let weak = ui.as_weak();
    let s2 = st.clone();
    ui.on_frame(move |tick| {
        let ui = weak.unwrap();
        let mut s = s2.borrow_mut();
        let now = tick as f64; // duration arrives as milliseconds
        let dt = if s.last_ms < 0.0 { 0.0 } else { now - s.last_ms };
        s.last_ms = now;
        let size = ui.window().size().to_logical(ui.window().scale_factor());
        let k = size.height / WORLD_H;
        let w = size.width / k;
        s.game.set_width(w);
        let before = s.game.phase;
        s.game.advance((dt / 1000.0) as f32);
        let ev = s.game.take_events();
        if !s.game.bot { flappy_sfx::on_events(ev); }
        if s.bench_on && dt > 0.0 {
            s.times.push(dt);
            s.bench_ms += dt;
            if s.bench_ms >= 60000.0 {
                s.bench_on = false;
                let mut lines = bench_stats(&s.times);
                flappy_core::report("slint", &lines);
                if let Some(l) = lines.last_mut() { *l = "Slint (Rust) | tap to close".into(); }
                s.result = lines.join("\n");
                s.game.bot = false;
                s.game.reset();
            }
        }
        if before != Phase::Dead && s.game.phase == Phase::Dead && !s.game.bot && s.game.score > s.best { s.best = s.game.score; }
        let State { game, prims, .. } = &mut *s;
        draw_list(game, w, prims);
        for i in 0..SLOTS {
            let shape = prims.get(i).map(|p| to_shape(p, k)).unwrap_or_else(|| blank.clone());
            if model.row_data(i).as_ref() != Some(&shape) { model.set_row_data(i, shape); }
        }
        let (big, small) = if s.bench_on {
            (String::new(), format!("Benchmark | {}s | score {}", 60 - (s.bench_ms / 1000.0) as i32, s.game.score))
        } else {
            match s.game.phase {
                Phase::Ready => ("Flappy Dash".into(), format!("Tap to flap | Best {} | Slint", s.best)),
                Phase::Playing => (s.game.score.to_string(), String::new()),
                Phase::Dead => ("Game over".into(), format!("Score {} | Best {} | tap to retry", s.game.score, s.best)),
            }
        };
        ui.set_big(big.into());
        ui.set_small(small.into());
        ui.set_show_bench_button(s.game.phase == Phase::Ready && !s.bench_on && s.result.is_empty());
        ui.set_result(s.result.clone().into());
    });

    let weak = ui.as_weak();
    let s2 = st.clone();
    ui.on_tap(move || {
        let mut s = s2.borrow_mut();
        if !s.result.is_empty() { s.result.clear(); let _ = weak.upgrade().map(|u| u.set_result("".into())); return; }
        if s.bench_on { return; }
        if s.game.phase == Phase::Dead { if s.game.can_restart() { s.game.reset(); } } else { s.game.flap(); }
    });
    let s2 = st.clone();
    ui.on_bench(move || {
        let mut s = s2.borrow_mut();
        s.times.clear();
        s.game.reset();
        s.game.seed = 1234;
        s.game.time = 0.0;
        s.game.bot = true;
        s.bench_ms = 0.0;
        s.bench_on = true;
    });
    ui.run().unwrap();
}

#[cfg(target_os = "android")]
#[no_mangle]
fn android_main(app: slint::android::AndroidApp) {
    slint::android::init(app).unwrap();
    run();
}
