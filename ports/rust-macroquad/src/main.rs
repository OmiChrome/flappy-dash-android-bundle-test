//! Flappy Dash - Rust + macroquad port. Immediate-mode drawing with circles, triangles and meshes.
mod engine;

use engine::*;
use macroquad::models::{draw_mesh, Mesh, Vertex};
use macroquad::prelude::*;

fn conf() -> Conf {
    Conf { window_title: "Flappy Dash (Rust)".into(), window_width: 400, window_height: 820, high_dpi: true, sample_count: 4, ..Default::default() }
}

const fn hex(c: u32) -> Color {
    Color::new(((c >> 16) & 255) as f32 / 255.0, ((c >> 8) & 255) as f32 / 255.0, (c & 255) as f32 / 255.0, 1.0)
}
// sky0 sky1 sky2 orb orbGlow hillFar hillNear cloud pillarA pillarB pillarLine cap capShade floor floorShade
const THEME: [[u32; 15]; 4] = [
    [0x8FD3FF, 0xC9ECFF, 0xFFF1F7, 0xFFF2A8, 0xFFF8D6, 0xC8EBD9, 0xA6E0C3, 0xFFFFFF, 0xFFC7DE, 0xF7A8CB, 0xC76E98, 0xFFFFFF, 0xF2E3F4, 0xFFFFFF, 0xEADCF5],
    [0xFFA9A3, 0xFFCB9A, 0xFFE8C2, 0xFFE08A, 0xFFD0A0, 0xF5B9B5, 0xEE9EA6, 0xFFF0E6, 0xC9B6FF, 0xAE96F5, 0x7A62C2, 0xFFF6F0, 0xF3DCD8, 0xFFF6F0, 0xF2D3CF],
    [0x7F7CD9, 0xB49BE8, 0xF2B8D8, 0xFFE9F5, 0xE8C9F5, 0x9F8FDC, 0x8A79D0, 0xEBDDFF, 0x9EE6D3, 0x7DD3BE, 0x3F8F7C, 0xF7F1FF, 0xDCCDF3, 0xF4EEFF, 0xD8C8F2],
    [0x1E2459, 0x3A3C8C, 0x6E5BAF, 0xFFF7D1, 0xB8B6F2, 0x3A3F86, 0x2E3270, 0x7D7BC9, 0xFFD39A, 0xF5B76E, 0xA7672A, 0xE9E5FF, 0xB9B3EA, 0xE2DCFF, 0xACA3E6],
];
const ORB_Y: [f32; 4] = [120.0, 330.0, 130.0, 110.0];
const MOON: [f32; 4] = [0.0, 0.0, 1.0, 1.0];
const LINE: Color = hex(0x6B4A2B);
const BODY: Color = hex(0xFFE27A);
const SHADE: Color = hex(0xFFC94A);
const BELLY: Color = hex(0xFFF6CF);
const WING: Color = hex(0xFFD25E);
const BEAK: Color = hex(0xFF9A55);
const INK: Color = hex(0x3D2C4E);
const GOLD: Color = hex(0xFFD45C);
const TILE: f32 = 360.0;
const FLOOR_TILE: f32 = 280.0;

fn lerp_c(a: Color, b: Color, t: f32) -> Color {
    Color::new(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t)
}
fn alpha(c: Color, a: f32) -> Color { Color::new(c.r, c.g, c.b, a) }
fn wrap(v: f32, m: f32) -> f32 { ((v % m) + m) % m }

/// World -> screen transform with optional local rotation/scale (for the bird).
#[derive(Clone, Copy)]
struct Xf { k: f32, ox: f32, oy: f32, tx: f32, ty: f32, cos: f32, sin: f32, sx: f32, sy: f32 }
impl Xf {
    fn world(k: f32, ox: f32, oy: f32) -> Self { Xf { k, ox, oy, tx: 0.0, ty: 0.0, cos: 1.0, sin: 0.0, sx: 1.0, sy: 1.0 } }
    fn local(&self, tx: f32, ty: f32, deg: f32, sx: f32, sy: f32) -> Self {
        let r = deg.to_radians();
        Xf { tx, ty, cos: r.cos(), sin: r.sin(), sx, sy, ..*self }
    }
    fn p(&self, x: f32, y: f32) -> Vec2 {
        let (x, y) = (x * self.sx, y * self.sy);
        let (rx, ry) = (x * self.cos - y * self.sin, x * self.sin + y * self.cos);
        vec2((rx + self.tx) * self.k + self.ox, (ry + self.ty) * self.k + self.oy)
    }
    fn r(&self, r: f32) -> f32 { r * self.k * (self.sx + self.sy) * 0.5 }
    fn circle(&self, x: f32, y: f32, r: f32, c: Color) { let p = self.p(x, y); draw_circle(p.x, p.y, self.r(r), c); }
    fn tri(&self, a: (f32, f32), b: (f32, f32), c: (f32, f32), col: Color) { draw_triangle(self.p(a.0, a.1), self.p(b.0, b.1), self.p(c.0, c.1), col); }
    fn rect(&self, x: f32, y: f32, w: f32, h: f32, c: Color) { let p = self.p(x, y); draw_rectangle(p.x, p.y, w * self.k, h * self.k, c); }
}

fn grad_quad(xf: &Xf, x: f32, y: f32, w: f32, h: f32, c: [Color; 4]) {
    // c: top-left, top-right, bottom-right, bottom-left
    let pts = [xf.p(x, y), xf.p(x + w, y), xf.p(x + w, y + h), xf.p(x, y + h)];
    let vertices = pts.iter().zip(c.iter()).map(|(p, c)| Vertex::new(p.x, p.y, 0.0, 0.0, 0.0, *c)).collect();
    draw_mesh(&Mesh { vertices, indices: vec![0, 1, 2, 0, 2, 3], texture: None });
}

fn round_rect(xf: &Xf, x: f32, y: f32, w: f32, h: f32, r: f32, c: Color) {
    xf.rect(x + r, y, w - 2.0 * r, h, c);
    xf.rect(x, y + r, w, h - 2.0 * r, c);
    for (cx, cy) in [(x + r, y + r), (x + w - r, y + r), (x + r, y + h - r), (x + w - r, y + h - r)] { xf.circle(cx, cy, r, c); }
}

fn star(xf: &Xf, r: f32, c: Color) {
    for i in 0..10 {
        let a0 = -std::f32::consts::FRAC_PI_2 + i as f32 * std::f32::consts::PI / 5.0;
        let a1 = a0 + std::f32::consts::PI / 5.0;
        let r0 = if i % 2 == 0 { r } else { r * 0.46 };
        let r1 = if i % 2 == 0 { r * 0.46 } else { r };
        xf.tri((0.0, 0.0), (a0.cos() * r0, a0.sin() * r0), (a1.cos() * r1, a1.sin() * r1), c);
    }
}

struct Art { hill_far: Vec<(f32, f32)>, hill_near: Vec<(f32, f32)>, fluff: Vec<(f32, f32, f32)> }
fn wave(amp: f32, base: f32, phase: f32, freq: f32) -> Vec<(f32, f32)> {
    (0..=60).map(|i| {
        let x = i as f32 * 6.0;
        let t = x / TILE * std::f32::consts::TAU;
        (x, base - amp * (0.55 + 0.3 * (t * freq + phase).sin() + 0.15 * (t * freq * 2.0 + phase * 3.0).sin()))
    }).collect()
}
fn hills(xf: &Xf, pts: &[(f32, f32)], dx: f32, c: Color) {
    let mut vertices = Vec::with_capacity(pts.len() * 2);
    let mut indices = Vec::with_capacity(pts.len() * 6);
    for (i, (x, y)) in pts.iter().enumerate() {
        let a = xf.p(x + dx, *y);
        let b = xf.p(x + dx, WORLD_H);
        vertices.push(Vertex::new(a.x, a.y, 0.0, 0.0, 0.0, c));
        vertices.push(Vertex::new(b.x, b.y, 0.0, 0.0, 0.0, c));
        if i > 0 {
            let j = (i * 2) as u16;
            indices.extend_from_slice(&[j - 2, j - 1, j, j - 1, j + 1, j]);
        }
    }
    draw_mesh(&Mesh { vertices, indices, texture: None });
}

fn draw_bird(w: &Xf, g: &Game) {
    let dead = g.phase == Phase::Dead;
    let sq = g.squash * g.squash;
    let b = w.local(g.bird_x, g.y, g.rot, 1.0 - 0.1 * sq, 1.0 + 0.13 * sq);
    let art_fluff = fluff_circles();
    for (x, y, r) in &art_fluff { b.circle(*x, *y, r + 2.2, LINE); }
    for (x, y, r) in &art_fluff { b.circle(*x, *y, *r, SHADE); }
    b.circle(-2.0, -3.0, 13.0, BODY);
    b.circle(-4.0, -6.0, 8.0, lerp_c(BODY, WHITE, 0.15));
    for i in 0..8 { b.circle(-8.0 + i as f32 * 2.6, 6.5, 4.0, BELLY); }
    b.circle(5.0, 5.5, 3.6, alpha(hex(0xFF8FB1), 0.55));
    if dead {
        let (p0, p1, p2, p3) = (b.p(4.0, -8.0), b.p(10.0, -2.0), b.p(10.0, -8.0), b.p(4.0, -2.0));
        draw_line(p0.x, p0.y, p1.x, p1.y, b.r(2.2), INK);
        draw_line(p2.x, p2.y, p3.x, p3.y, b.r(2.2), INK);
    } else {
        let bt = g.time % 3.7;
        let open = if bt < 0.12 { ((bt - 0.06).abs() / 0.06).max(0.12) } else { 1.0 };
        let e = b.local(0.0, 0.0, 0.0, 1.0, 1.0);
        let _ = e;
        b.circle(7.0, -5.0, 6.8, LINE);
        b.circle(7.0, -5.0, 5.8 * if open < 1.0 { open.max(0.3) } else { 1.0 }, WHITE);
        if open >= 1.0 { b.circle(8.6, -4.6, 3.3, INK); b.circle(9.6, -6.1, 1.25, WHITE); }
    }
    b.tri((12.0, -5.0), (25.0, 1.0), (12.0, 7.5), LINE);
    b.tri((13.0, -3.5), (23.0, 1.0), (13.0, 6.0), BEAK);
    let since = g.time - g.flap_at;
    let wing_a = if dead { -30.0 } else if since < 0.32 || g.vy < -60.0 { (g.time * 34.0).sin() * 32.0 - 8.0 } else { 8.0 + (g.time * 4.0).sin() * 4.0 };
    let wr = (g.rot + wing_a).to_radians();
    let center = b.p(-5.0, 3.0);
    let k = b.r(1.0);
    for (dx, dy, r) in [(-2.0, 0.0, 8.0), (-9.0, 3.0, 4.5), (-4.0, 5.0, 4.5)] {
        let (rx, ry) = (dx * wr.cos() - dy * wr.sin(), dx * wr.sin() + dy * wr.cos());
        draw_circle(center.x + rx * k, center.y + ry * k, (r + 1.9) * k, LINE);
    }
    for (dx, dy, r) in [(-2.0, 0.0, 8.0), (-9.0, 3.0, 4.5), (-4.0, 5.0, 4.5)] {
        let (rx, ry) = (dx * wr.cos() - dy * wr.sin(), dx * wr.sin() + dy * wr.cos());
        draw_circle(center.x + rx * k, center.y + ry * k, r * k, WING);
    }
}

fn fluff_circles() -> Vec<(f32, f32, f32)> {
    let mut v = vec![(0.0, 0.0, 14.0)];
    for i in 0..13 { let a = i as f32 / 13.0 * std::f32::consts::TAU; v.push((a.cos() * 12.0, a.sin() * 11.5, 6.2)); }
    v.push((-3.0, -18.0, 4.2));
    v.push((2.5, -19.5, 3.4));
    v
}

fn draw_scene(g: &Game, art: &Art) {
    let (sw, sh) = (screen_width(), screen_height());
    let k = sh / WORLD_H;
    let w = sw / k;
    let (sx, sy) = if g.shake > 0.0 { ((g.time * 91.0).sin() * g.shake * g.shake * 7.0 * k, (g.time * 77.0).cos() * g.shake * g.shake * 7.0 * k) } else { (0.0, 0.0) };
    let xf = Xf::world(k, sx, sy);
    let m = g.theme_mix;
    let tc = |i: usize| lerp_c(hex(THEME[g.theme_from][i]), hex(THEME[g.theme][i]), m);

    grad_quad(&xf, -20.0, -20.0, w + 40.0, FLOOR_Y * 0.6 + 20.0, [tc(0), tc(0), tc(1), tc(1)]);
    grad_quad(&xf, -20.0, FLOOR_Y * 0.6, w + 40.0, FLOOR_Y * 0.4, [tc(1), tc(1), tc(2), tc(2)]);
    xf.rect(-20.0, FLOOR_Y, w + 40.0, WORLD_H, tc(2));

    let night = MOON[g.theme_from] * (1.0 - m) + MOON[g.theme] * m;
    if night > 0.01 {
        for i in 0..34 {
            let tw = 0.55 + 0.45 * (g.time * 2.0 + (i * 3) as f32).sin();
            xf.circle(((i as f32 * 97.3) % 520.0) % w, 18.0 + (i as f32 * 53.7) % 340.0, 0.8 + (i * 7 % 3) as f32 * 0.55, alpha(WHITE, night * tw * 0.9));
        }
    }
    let orb_y = ORB_Y[g.theme_from] + (ORB_Y[g.theme] - ORB_Y[g.theme_from]) * m;
    let orb_x = w * 0.76;
    for (r, a) in [(58.0, 0.12), (48.0, 0.18), (38.0, 0.25)] { xf.circle(orb_x, orb_y, r, alpha(tc(4), a)); }
    xf.circle(orb_x, orb_y, 28.0, tc(3));
    if night > 0.01 { xf.circle(orb_x + 11.0, orb_y - 7.0, 23.0, alpha(tc(4), night)); }

    let clouds: [(f32, f32, f32, f32, f32); 4] = [(40.0, 96.0, 1.0, 7.0, 0.08), (250.0, 170.0, 0.7, 5.0, 0.06), (380.0, 64.0, 0.85, 9.0, 0.1), (150.0, 262.0, 0.55, 4.0, 0.05)];
    let span = w + 220.0;
    let cc = alpha(tc(7), 0.92);
    for (cx, cy, s, v, d) in clouds {
        let x = wrap(cx - g.time * v - g.scroll * d, span) - 110.0;
        let c = xf.local(x, cy, 0.0, s, s);
        for (px, py, r) in [(0.0, 0.0, 20.0), (24.0, -12.0, 25.0), (52.0, -4.0, 21.0), (74.0, 6.0, 15.0)] { c.circle(px, py, r, cc); }
        let p = c.p(-12.0, 0.0);
        draw_rectangle(p.x, p.y, 98.0 * s * k, 22.0 * s * k, cc);
    }

    let tiles = (w / TILE).ceil() as i32 + 1;
    let far = -wrap(g.scroll * 0.18, TILE);
    for i in 0..tiles { hills(&xf, &art.hill_far, far + i as f32 * TILE, tc(5)); }
    let near = -wrap(g.scroll * 0.42, TILE);
    for i in 0..tiles { hills(&xf, &art.hill_near, near + i as f32 * TILE, tc(6)); }

    let (line, cap, cap_shade, pa, pb) = (tc(10), tc(11), tc(12), tc(8), tc(9));
    for (idx, p) in g.pillars.iter().enumerate() {
        if !p.on { continue; }
        let (top, bot) = (p.gap_y - p.gap / 2.0, p.gap_y + p.gap / 2.0);
        for (y0, y1) in [(-40.0, top - CAP_H + 4.0), (bot + CAP_H - 4.0, FLOOR_Y + 40.0)] {
            round_rect(&xf, p.x - PILLAR_W / 2.0 - 1.2, y0 - 1.2, PILLAR_W + 2.4, y1 - y0 + 2.4, 12.0, line);
            grad_quad(&xf, p.x - PILLAR_W / 2.0 + 1.2, y0, PILLAR_W * 0.35, y1 - y0, [pa, pa, pa, pa]);
            grad_quad(&xf, p.x - PILLAR_W / 2.0 + PILLAR_W * 0.35, y0, PILLAR_W * 0.65 - 1.2, y1 - y0, [pa, pb, pb, pa]);
            xf.rect(p.x - PILLAR_W / 2.0 + 9.0, y0, 9.0, y1 - y0, alpha(WHITE, 0.38));
        }
        for (cy, puff_y) in [(top - CAP_H, CAP_H - 3.0), (bot, 3.0)] {
            for (dy, col, grow) in [(0.0, line, 2.4), (0.0, cap_shade, 0.0), (-3.0, cap, 0.0)] {
                round_rect(&xf, p.x - CAP_W / 2.0 - grow, cy + dy - grow, CAP_W + grow * 2.0, CAP_H + grow * 2.0, 12.0, col);
                for i in 0..4 { xf.circle(p.x - CAP_W / 2.0 + 12.0 + i as f32 * ((CAP_W - 24.0) / 3.0), cy + dy + puff_y, 11.0 + grow, col); }
            }
        }
        if p.star == 1 {
            let sy = p.gap_y + p.star_dy + (g.time * 3.0 + idx as f32).sin() * 3.0;
            xf.circle(p.x, sy, 20.0, alpha(GOLD, 0.25));
            let s = xf.local(p.x, sy, (g.time * 2.4 + idx as f32).sin() * 14.0, 1.0, 1.0);
            star(&s.local(p.x, sy, (g.time * 2.4 + idx as f32).sin() * 14.0, 1.15, 1.15), 12.0, WHITE);
            star(&s, 12.0, GOLD);
        }
    }

    let f_tiles = (w / FLOOR_TILE).ceil() as i32 + 1;
    for (shift, dy, col) in [(-wrap(g.scroll * 0.75 + 14.0, FLOOR_TILE), -8.0, tc(14)), (-wrap(g.scroll, FLOOR_TILE), 4.0, tc(13))] {
        for t in 0..f_tiles {
            let ox = shift + t as f32 * FLOOR_TILE;
            let mut x = -14.0;
            while x <= FLOOR_TILE + 14.0 { xf.circle(ox + x, FLOOR_Y + 12.0 + dy, 17.0, col); x += 28.0; }
            xf.rect(ox - 14.0, FLOOR_Y + 12.0 + dy, FLOOR_TILE + 28.0, WORLD_H, col);
        }
    }
    let h = ((FLOOR_Y - g.y) / 300.0).clamp(0.0, 1.0);
    let sp = xf.p(g.bird_x, FLOOR_Y + 10.0);
    draw_ellipse(sp.x, sp.y, 18.0 * (1.0 - h * 0.5) * k, 5.0 * k, 0.0, alpha(INK, 0.16 * (1.0 - h * 0.7)));

    for q in g.parts.iter() {
        if q.life <= 0.0 || q.kind == P_SPARK { continue; }
        let t = q.life / q.max;
        if q.kind == P_FLUFF { xf.circle(q.x, q.y, q.size * (1.6 - t * 0.6), alpha(WHITE, t * 0.9)); } else {
            let p = xf.p(q.x, q.y);
            draw_ellipse(p.x, p.y, q.size * 1.6 * k, q.size * 0.7 * k, q.x * 3.0, alpha(SHADE, (t * 1.6).min(1.0)));
        }
    }
    draw_bird(&xf, g);
    for (i, q) in g.parts.iter().enumerate() {
        if q.life <= 0.0 || q.kind != P_SPARK { continue; }
        let t = q.life / q.max;
        let s = 0.45 * (0.5 + t);
        star(&xf.local(q.x, q.y, g.time * 200.0 + i as f32 * 40.0, s, s), 12.0, alpha(hex(0xFFF4B0), t));
    }
    if g.flash > 0.0 { draw_rectangle(0.0, 0.0, sw, sh, alpha(WHITE, g.flash * 0.55)); }
}

fn text_c(s: &str, x: f32, y: f32, size: f32, c: Color) {
    let d = measure_text(s, None, size as u16, 1.0);
    draw_text(s, x - d.width / 2.0 + size * 0.04, y + size * 0.08, size, hex(0x9479DB));
    draw_text(s, x - d.width / 2.0, y, size, c);
}

fn best_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "android")]
    { let d = std::path::PathBuf::from("/data/data/com.flappydash.rust/files"); let _ = std::fs::create_dir_all(&d); Some(d.join("best.txt")) }
    #[cfg(all(not(target_os = "android"), not(target_arch = "wasm32")))]
    { Some(std::path::PathBuf::from("flappy_dash_best.txt")) }
    #[cfg(target_arch = "wasm32")]
    { None }
}
fn load_best() -> u32 { best_path().and_then(|p| std::fs::read_to_string(p).ok()).and_then(|s| s.trim().parse().ok()).unwrap_or(0) }
fn save_best(v: u32) { if let Some(p) = best_path() { let _ = std::fs::write(p, v.to_string()); } }

#[macroquad::main(conf)]
async fn main() {
    let art = Art { hill_far: wave(78.0, FLOOR_Y - 10.0, 0.2, 2.0), hill_near: wave(52.0, FLOOR_Y + 8.0, 1.4, 3.0), fluff: fluff_circles() };
    let _ = &art.fluff;
    let mut g = Game::new(360.0, (macroquad::miniquad::date::now() * 1000.0) as i32);
    let mut best = load_best();
    let mut bench_on = false;
    let mut bench_ms = 0.0f64;
    let mut times: Vec<f64> = Vec::with_capacity(10000);
    let mut result: Option<Vec<String>> = None;

    loop {
        let (sw, sh) = (screen_width(), screen_height());
        g.set_width(sw / (sh / WORLD_H));
        let dt = get_frame_time();
        let before = g.phase;
        g.advance(dt);
        if bench_on {
            times.push(dt as f64 * 1000.0);
            bench_ms += dt as f64 * 1000.0;
            if bench_ms >= 60000.0 { bench_on = false; result = Some(bench_stats(&times)); g.bot = false; g.reset(); }
        }
        if before != Phase::Dead && g.phase == Phase::Dead && !g.bot && g.score > best { best = g.score; save_best(best); }

        let tapped = is_mouse_button_pressed(MouseButton::Left) || is_key_pressed(KeyCode::Space) || is_key_pressed(KeyCode::Up);
        if tapped {
            let (_, my) = mouse_position();
            if result.is_some() { result = None; } else if bench_on {
            } else if g.phase == Phase::Ready && is_mouse_button_pressed(MouseButton::Left) && my > sh * 0.78 && my < sh * 0.88 {
                times.clear(); g.reset(); g.seed = 1234; g.time = 0.0; g.bot = true; bench_ms = 0.0; bench_on = true;
            } else if g.phase == Phase::Dead { if g.can_restart() { g.reset(); } } else { g.flap(); }
        }

        clear_background(hex(0xC9ECFF));
        draw_scene(&g, &art);
        let u = sh / 820.0;
        let cx = sw / 2.0;
        if let Some(r) = &result {
            draw_rectangle(sw * 0.06, sh * 0.25, sw * 0.88, (40.0 + 28.0 * r.len() as f32) * u, WHITE);
            for (i, l) in r.iter().enumerate() {
                let size = if i == 0 { 30.0 } else { 17.0 } * u;
                let d = measure_text(l, None, size as u16, 1.0);
                draw_text(l, cx - d.width / 2.0, sh * 0.25 + (36.0 + 28.0 * i as f32) * u, size, hex(0x4A3763));
            }
        } else if bench_on {
            text_c(&format!("Benchmark | {}s | score {}", 60 - (bench_ms / 1000.0) as i32, g.score), cx, 60.0 * u, 26.0 * u, WHITE);
        } else {
            match g.phase {
                Phase::Playing => text_c(&g.score.to_string(), cx, 110.0 * u, 80.0 * u, WHITE),
                Phase::Ready => {
                    text_c("Flappy", cx, 140.0 * u, 72.0 * u, WHITE);
                    text_c("Dash", cx, 196.0 * u, 56.0 * u, hex(0xFFD36B));
                    text_c(&format!("Tap to flap | Best {}", best), cx, 240.0 * u, 24.0 * u, WHITE);
                    draw_rectangle(cx - 140.0 * u, sh * 0.79, 280.0 * u, sh * 0.08, hex(0x55BF98));
                    text_c("Benchmark (60 s)", cx, sh * 0.835, 28.0 * u, WHITE);
                    text_c("Rust + macroquad", cx, sh * 0.93, 20.0 * u, WHITE);
                }
                Phase::Dead => {
                    text_c("Game over", cx, sh * 0.3, 58.0 * u, WHITE);
                    draw_rectangle(cx - 120.0 * u, sh * 0.34, 240.0 * u, 100.0 * u, WHITE);
                    let s1 = format!("SCORE {}", g.score);
                    let d = measure_text(&s1, None, (36.0 * u) as u16, 1.0);
                    draw_text(&s1, cx - d.width / 2.0, sh * 0.34 + 45.0 * u, 36.0 * u, hex(0x4A3763));
                    let s2 = format!("BEST {}", best);
                    let d = measure_text(&s2, None, (26.0 * u) as u16, 1.0);
                    draw_text(&s2, cx - d.width / 2.0, sh * 0.34 + 82.0 * u, 26.0 * u, hex(0x4A3763));
                    text_c("Tap to retry", cx, sh * 0.34 + 140.0 * u, 26.0 * u, WHITE);
                }
            }
        }
        next_frame().await
    }
}
