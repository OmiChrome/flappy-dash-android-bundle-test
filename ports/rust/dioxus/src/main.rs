//! Flappy Dash - Dioxus port. React-style Rust UI: each frame the shared draw list
//! (flappy_core::draw) becomes SVG circles/rects in RSX; Dioxus diffs and patches the WebView DOM.
//! The frame clock is the WebView's requestAnimationFrame, sent to Rust through `eval`.
//! Sounds: the shared .wav files, decoded once by the page's Web Audio; vibration via navigator.vibrate.
use dioxus::prelude::*;
use flappy_core::draw::{draw_list, Prim};
use flappy_core::{bench_stats, report, Game, Phase, WORLD_H};

fn main() {
    dioxus::launch(App);
}

struct Bench { on: bool, ms: f64, times: Vec<f64>, result: Option<Vec<String>> }

fn hex(c: u32) -> String { format!("#{c:06X}") }

fn base64(b: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(b.len() * 4 / 3 + 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 { s.push(if i <= c.len() { T[(n >> (18 - 6 * i) & 63) as usize] as char } else { '=' }); }
    }
    s
}

fn sfx_name(s: flappy_sfx::Sfx) -> String { format!("{s:?}").to_lowercase() }

// Plays what Rust sends: first the clips, then one [names, vibrate_ms] message per frame with events.
const SFX_JS: &str = r#"const C = new (window.AudioContext || window.webkitAudioContext)();
    const bufs = {};
    for (const [n, uri, v] of await dioxus.recv()) {
      fetch(uri).then(r => r.arrayBuffer()).then(b => C.decodeAudioData(b)).then(d => { bufs[n] = [d, v]; }).catch(() => {});
    }
    addEventListener('pointerdown', () => { if (C.state !== 'running') C.resume(); }, { capture: true });
    while (true) {
      const [names, buzz] = await dioxus.recv();
      for (const n of names) {
        const e = bufs[n]; if (!e) continue;
        const s = C.createBufferSource(), g = C.createGain();
        s.buffer = e[0]; g.gain.value = e[1]; s.connect(g).connect(C.destination); s.start();
      }
      if (buzz && navigator.vibrate) navigator.vibrate(buzz);
    }"#;

#[component]
fn App() -> Element {
    // seeded from the first frame's timestamp (SystemTime is not available in the browser)
    let mut game = use_signal(|| Game::new(360.0, 1));
    let mut prims = use_signal(Vec::<Prim>::new);
    let mut bench = use_signal(|| Bench { on: false, ms: 0.0, times: Vec::with_capacity(10000), result: None });
    let mut best = use_signal(|| 0u32);
    let mut view = use_signal(|| (400.0f64, 820.0f64));

    // frame loop: the page calls back on every animation frame with its size and timestamp
    use_future(move || async move {
        let mut js = document::eval(
            r#"let last = 0;
               function f(t) { dioxus.send([t, innerWidth, innerHeight]); requestAnimationFrame(f); }
               requestAnimationFrame(f);
               await new Promise(() => {});"#,
        );
        let sfx = document::eval(SFX_JS);
        let clips: Vec<(String, String, f32)> = flappy_sfx::WAVS.iter().filter(|w| w.0 != flappy_sfx::Sfx::Best)
            .map(|(k, b, v)| (sfx_name(*k), format!("data:audio/wav;base64,{}", base64(b)), *v)).collect();
        let _ = sfx.send(clips);
        let mut last = -1.0f64;
        while let Ok([t, w, h]) = js.recv::<[f64; 3]>().await {
            if last < 0.0 { game.write().seed = (t * 1000.0) as i32 | 1; }
            let dt = if last < 0.0 { 0.0 } else { t - last };
            last = t;
            view.set((w, h));
            let world_w = (w / (h / WORLD_H as f64)) as f32;
            let mut g = game.write();
            g.set_width(world_w);
            let before = g.phase;
            g.advance((dt / 1000.0) as f32);
            let ev = g.take_events();
            if ev != 0 && !g.bot {
                let (names, buzz) = flappy_sfx::reactions(ev);
                let _ = sfx.send((names.into_iter().map(sfx_name).collect::<Vec<_>>(), buzz));
            }
            {
                let mut b = bench.write();
                if b.on && dt > 0.0 {
                    b.times.push(dt);
                    b.ms += dt;
                    if b.ms >= 60000.0 {
                        b.on = false;
                        let lines = bench_stats(&b.times);
                        report("dioxus", &lines);
                        b.result = Some(lines);
                        g.bot = false;
                        g.reset();
                    }
                }
            }
            if before != Phase::Dead && g.phase == Phase::Dead && !g.bot && g.score > best() { best.set(g.score); }
            let mut p = prims.write();
            draw_list(&g, world_w, &mut p);
        }
    });

    let (w, h) = view();
    let world_w = w / (h / WORLD_H as f64);
    let g = game.read();
    let b = bench.read();
    let status = if b.on {
        format!("Benchmark | {}s | score {}", 60 - (b.ms / 1000.0) as i32, g.score)
    } else {
        match g.phase {
            Phase::Ready => format!("Tap to flap | Best {} | Dioxus", best()),
            Phase::Playing => g.score.to_string(),
            Phase::Dead => format!("Game over | Score {} | Best {} | tap to retry", g.score, best()),
        }
    };
    let show_button = g.phase == Phase::Ready && !b.on && b.result.is_none();
    let result = b.result.clone();
    drop(g);
    drop(b);

    rsx! {
        style { "html,body{{margin:0;height:100%;overflow:hidden;background:#C9ECFF;font-family:sans-serif;user-select:none}}" }
        div {
            style: "position:fixed;inset:0;touch-action:none",
            onpointerdown: move |_| {
                if bench.read().result.is_some() { bench.write().result = None; return; }
                if bench.read().on { return; }
                let mut g = game.write();
                if g.phase == Phase::Dead { if g.can_restart() { g.reset(); } } else { g.flap(); }
            },
            svg {
                width: "100%", height: "100%",
                view_box: "0 0 {world_w} {WORLD_H}",
                preserve_aspect_ratio: "xMidYMid slice",
                for (i, p) in prims.read().iter().enumerate() {
                    if p.kind == 0 {
                        circle { key: "{i}", cx: "{p.x}", cy: "{p.y}", r: "{p.w / 2.0}", fill: hex(p.color), fill_opacity: "{p.alpha}" }
                    } else {
                        rect { key: "{i}", x: "{p.x}", y: "{p.y}", width: "{p.w}", height: "{p.h}", fill: hex(p.color), fill_opacity: "{p.alpha}" }
                    }
                }
            }
            div { style: "position:absolute;top:8%;width:100%;text-align:center;color:white;font-weight:900;font-size:28px;text-shadow:0 3px #9479DB", "{status}" }
        }
        if show_button {
            button {
                style: "position:fixed;left:50%;top:80%;transform:translateX(-50%);padding:16px 28px;border:0;border-radius:30px;background:#55BF98;color:white;font-size:20px;font-weight:700",
                onpointerdown: move |e| {
                    e.stop_propagation();
                    let mut g = game.write();
                    g.reset(); g.seed = 1234; g.time = 0.0; g.bot = true;
                    let mut b = bench.write();
                    b.times.clear(); b.ms = 0.0; b.on = true;
                },
                "Benchmark (60 s)"
            }
        }
        if let Some(lines) = result {
            div {
                style: "position:fixed;left:6%;right:6%;top:25%;background:white;border-radius:28px;padding:20px;color:#4A3763;text-align:center",
                onpointerdown: move |_| { bench.write().result = None; },
                for l in lines { div { "{l}" } }
            }
        }
    }
}
