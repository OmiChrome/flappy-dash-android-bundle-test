//! Flappy Dash - Bevy port. Draws the shared draw list (flappy_core::draw) with a pool of
//! sprite entities (one white square and one white circle texture, tinted per shape).
use bevy::asset::RenderAssetUsages;
use bevy::prelude::*;
use bevy::render::render_resource::{Extent3d, TextureDimension, TextureFormat};
use flappy_core::draw::{draw_list, Prim};
use flappy_core::{bench_stats, Game, Phase, WORLD_H};

const SLOTS: usize = 900;

#[derive(Resource)]
struct State {
    game: Game,
    prims: Vec<Prim>,
    bench_on: bool,
    bench_ms: f64,
    times: Vec<f64>,
    result: Option<String>,
    best: u32,
}

#[derive(Resource)]
struct Tex { circle: Handle<Image> }

#[derive(Component)]
struct Slot(usize);
#[derive(Component)]
struct Hud;

fn circle_image() -> Image {
    let n = 128u32;
    let mut data = vec![0u8; (n * n * 4) as usize];
    for y in 0..n {
        for x in 0..n {
            let (dx, dy) = (x as f32 + 0.5 - n as f32 / 2.0, y as f32 + 0.5 - n as f32 / 2.0);
            let d = (dx * dx + dy * dy).sqrt();
            let a = (n as f32 / 2.0 - d + 0.5).clamp(0.0, 1.0); // 1px soft edge = anti-aliased
            let i = ((y * n + x) * 4) as usize;
            data[i..i + 4].copy_from_slice(&[255, 255, 255, (a * 255.0) as u8]);
        }
    }
    Image::new(Extent3d { width: n, height: n, depth_or_array_layers: 1 }, TextureDimension::D2, data, TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::RENDER_WORLD)
}

fn setup(mut commands: Commands, mut images: ResMut<Assets<Image>>) {
    commands.spawn(Camera2d);
    let circle = images.add(circle_image());
    for i in 0..SLOTS {
        commands.spawn((Sprite { color: Color::NONE, custom_size: Some(Vec2::ZERO), ..default() }, Transform::from_xyz(0.0, 0.0, i as f32 * 0.001), Slot(i)));
    }
    commands.spawn((Text2d::new(""), TextFont { font_size: bevy::text::FontSize::Px(20.0), ..default() }, TextColor(Color::WHITE), Transform::from_xyz(0.0, 0.0, 10.0), Hud));
    commands.insert_resource(Tex { circle });
    let seed = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i32).unwrap_or(1);
    commands.insert_resource(State { game: Game::new(360.0, seed), prims: Vec::with_capacity(SLOTS), bench_on: false, bench_ms: 0.0, times: Vec::with_capacity(10000), result: None, best: 0 });
}

fn frame(
    time: Res<Time>,
    windows: Query<&Window>,
    mouse: Res<ButtonInput<MouseButton>>,
    touches: Res<Touches>,
    tex: Res<Tex>,
    mut st: ResMut<State>,
    mut sprites: Query<(&Slot, &mut Sprite, &mut Transform)>,
    mut hud: Query<(&mut Text2d, &mut Transform), (With<Hud>, Without<Slot>)>,
) {
    let Ok(win) = windows.single() else { return };
    let (sw, sh) = (win.width(), win.height());
    let k = sh / WORLD_H;
    let w = sw / k;
    let s = &mut *st;
    s.game.set_width(w);

    // input: a tap anywhere; the bottom band starts the benchmark on the ready screen
    let tap_y = mouse.just_pressed(MouseButton::Left).then(|| win.cursor_position()).flatten().map(|p| p.y)
        .or_else(|| touches.iter_just_pressed().next().map(|t| t.position().y));
    if let Some(y) = tap_y {
        if s.result.is_some() { s.result = None; }
        else if s.bench_on {}
        else if s.game.phase == Phase::Ready && y > sh * 0.78 && y < sh * 0.88 {
            s.times.clear(); s.game.reset(); s.game.seed = 1234; s.game.time = 0.0; s.game.bot = true; s.bench_ms = 0.0; s.bench_on = true;
        } else if s.game.phase == Phase::Dead { if s.game.can_restart() { s.game.reset(); } } else { s.game.flap(); }
    }

    let dt = time.delta_secs_f64() * 1000.0;
    let before = s.game.phase;
    s.game.advance((dt / 1000.0) as f32);
    if s.bench_on && dt > 0.0 {
        s.times.push(dt);
        s.bench_ms += dt;
        if s.bench_ms >= 60000.0 {
            s.bench_on = false;
            let mut lines = bench_stats(&s.times);
            flappy_core::report("bevy", &lines);
            if let Some(l) = lines.last_mut() { *l = "Bevy (Rust) | tap to close".into(); }
            s.result = Some(lines.join("\n"));
            s.game.bot = false;
            s.game.reset();
        }
    }
    if before != Phase::Dead && s.game.phase == Phase::Dead && !s.game.bot && s.game.score > s.best { s.best = s.game.score; }

    let State { game, prims, .. } = s;
    draw_list(game, w, prims);
    // ready screen: benchmark button as two extra shapes
    if game.phase == Phase::Ready && !s.bench_on && s.result.is_none() {
        let (bw, bh) = (260.0 / k, 56.0 / k);
        prims.push(Prim { kind: 1, x: w / 2.0 - bw / 2.0, y: WORLD_H * 0.79, w: bw, h: bh, color: 0x55BF98, alpha: 1.0 });
    }
    for (slot, mut sprite, mut tf) in sprites.iter_mut() {
        match prims.get(slot.0) {
            Some(p) => {
                let c = p.color;
                sprite.color = Color::srgba_u8((c >> 16) as u8, (c >> 8) as u8, c as u8, (p.alpha.clamp(0.0, 1.0) * 255.0) as u8);
                sprite.custom_size = Some(Vec2::new(p.w * k, p.h * k));
                let (cx, cy) = if p.kind == 0 { (p.x, p.y) } else { (p.x + p.w / 2.0, p.y + p.h / 2.0) };
                tf.translation.x = cx * k - sw / 2.0;
                tf.translation.y = sh / 2.0 - cy * k;
                let want = if p.kind == 0 { tex.circle.clone() } else { Handle::default() };
                if sprite.image != want { sprite.image = want; }
            }
            None => { sprite.custom_size = Some(Vec2::ZERO); }
        }
    }
    if let Ok((mut text, mut tf)) = hud.single_mut() {
        let msg = if let Some(r) = &s.result { r.clone() }
            else if s.bench_on { format!("Benchmark | {}s | score {}", 60 - (s.bench_ms / 1000.0) as i32, game.score) }
            else { match game.phase {
                Phase::Ready => format!("Flappy Dash\nTap to flap | Best {}\n\n\n\n\n\n\n\n\n\n\nBenchmark (60 s)", s.best),
                Phase::Playing => game.score.to_string(),
                Phase::Dead => format!("Game over\nScore {} | Best {}\nTap to retry", game.score, s.best),
            } };
        if text.0 != msg { text.0 = msg; }
        tf.translation.y = if s.result.is_some() { 0.0 } else { sh / 2.0 - 140.0 };
    }
}

pub fn app() -> App {
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: Some(Window { title: "Flappy Dash (Bevy)".into(), resolution: (400, 820).into(), ..default() }),
        ..default()
    }))
    .insert_resource(ClearColor(Color::srgb_u8(0xC9, 0xEC, 0xFF)))
    .add_systems(Startup, setup)
    .add_systems(Update, frame);
    app
}

#[bevy_main]
fn main() {
    app().run();
}
