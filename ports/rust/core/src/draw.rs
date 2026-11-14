//! Draw list: turns the game state into simple shapes (circles and rectangles) in world units.
//! Every Rust UI port (Slint, Dioxus, Bevy, Crux, UniFFI) draws this same list its own way,
//! so they all render identical frames. Coordinates: world is 640 units tall; multiply by
//! `screen_height / 640` to get pixels.
use crate::{Game, Phase, BIRD_R, CAP_H, CAP_W, FLOOR_Y, PILLAR_W, P_FEATHER, P_FLUFF, P_SPARK, WORLD_H};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Prim {
    /// 0 = circle (x, y = centre, w = h = diameter), 1 = rectangle (x, y = top-left)
    pub kind: u8,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// 0xRRGGBB
    pub color: u32,
    pub alpha: f32,
}

// sky0 sky1 sky2 orb orbGlow hillFar hillNear cloud pillarA pillarB pillarLine cap capShade floor floorShade
pub const THEME: [[u32; 15]; 4] = [
    [0x8FD3FF, 0xC9ECFF, 0xFFF1F7, 0xFFF2A8, 0xFFF8D6, 0xC8EBD9, 0xA6E0C3, 0xFFFFFF, 0xFFC7DE, 0xF7A8CB, 0xC76E98, 0xFFFFFF, 0xF2E3F4, 0xFFFFFF, 0xEADCF5],
    [0xFFA9A3, 0xFFCB9A, 0xFFE8C2, 0xFFE08A, 0xFFD0A0, 0xF5B9B5, 0xEE9EA6, 0xFFF0E6, 0xC9B6FF, 0xAE96F5, 0x7A62C2, 0xFFF6F0, 0xF3DCD8, 0xFFF6F0, 0xF2D3CF],
    [0x7F7CD9, 0xB49BE8, 0xF2B8D8, 0xFFE9F5, 0xE8C9F5, 0x9F8FDC, 0x8A79D0, 0xEBDDFF, 0x9EE6D3, 0x7DD3BE, 0x3F8F7C, 0xF7F1FF, 0xDCCDF3, 0xF4EEFF, 0xD8C8F2],
    [0x1E2459, 0x3A3C8C, 0x6E5BAF, 0xFFF7D1, 0xB8B6F2, 0x3A3F86, 0x2E3270, 0x7D7BC9, 0xFFD39A, 0xF5B76E, 0xA7672A, 0xE9E5FF, 0xB9B3EA, 0xE2DCFF, 0xACA3E6],
];
const ORB_Y: [f32; 4] = [120.0, 330.0, 130.0, 110.0];
const MOON: [f32; 4] = [0.0, 0.0, 1.0, 1.0];
const LINE: u32 = 0x6B4A2B;
const BODY: u32 = 0xFFE27A;
const SHADE: u32 = 0xFFC94A;
const BELLY: u32 = 0xFFF6CF;
const WING: u32 = 0xFFD25E;
const BEAK: u32 = 0xFF9A55;
const INK: u32 = 0x3D2C4E;
const GOLD: u32 = 0xFFD45C;
const WHITE: u32 = 0xFFFFFF;

pub fn mix(a: u32, b: u32, t: f32) -> u32 {
    if t >= 1.0 { return b; }
    let ch = |s: u32| {
        let x = ((a >> s) & 255) as f32;
        let y = ((b >> s) & 255) as f32;
        ((x + (y - x) * t) as u32) << s
    };
    ch(16) | ch(8) | ch(0)
}

fn wrap(v: f32, m: f32) -> f32 { ((v % m) + m) % m }

struct Out<'a>(&'a mut Vec<Prim>);
impl Out<'_> {
    fn c(&mut self, x: f32, y: f32, r: f32, color: u32, alpha: f32) {
        self.0.push(Prim { kind: 0, x, y, w: r * 2.0, h: r * 2.0, color, alpha });
    }
    fn r(&mut self, x: f32, y: f32, w: f32, h: f32, color: u32, alpha: f32) {
        self.0.push(Prim { kind: 1, x, y, w, h, color, alpha });
    }
}

/// Fills `out` with this frame's shapes. `w` is the visible world width.
pub fn draw_list(g: &Game, w: f32, out: &mut Vec<Prim>) {
    out.clear();
    let mut o = Out(out);
    let m = g.theme_mix;
    let tc = |i: usize| mix(THEME[g.theme_from][i], THEME[g.theme][i], m);
    let (sx, sy) = if g.shake > 0.0 { ((g.time * 91.0).sin() * g.shake * g.shake * 7.0, (g.time * 77.0).cos() * g.shake * g.shake * 7.0) } else { (0.0, 0.0) };

    // sky: 12 bands approximate the 3-stop gradient
    let bands = 12;
    for i in 0..bands {
        let t = i as f32 / (bands - 1) as f32;
        let col = if t < 0.6 { mix(tc(0), tc(1), t / 0.6) } else { mix(tc(1), tc(2), (t - 0.6) / 0.4) };
        let y0 = FLOOR_Y * i as f32 / bands as f32;
        o.r(-20.0, y0 - if i == 0 { 30.0 } else { 0.0 }, w + 40.0, FLOOR_Y / bands as f32 + 1.0 + if i == 0 { 30.0 } else { 0.0 }, col, 1.0);
    }
    o.r(-20.0, FLOOR_Y, w + 40.0, WORLD_H - FLOOR_Y + 30.0, tc(2), 1.0);

    let night = MOON[g.theme_from] * (1.0 - m) + MOON[g.theme] * m;
    if night > 0.01 {
        for i in 0..34 {
            let tw = 0.55 + 0.45 * (g.time * 2.0 + (i * 3) as f32).sin();
            o.c(((i as f32 * 97.3) % 520.0) % w, 18.0 + (i as f32 * 53.7) % 340.0, 0.8 + (i * 7 % 3) as f32 * 0.55, WHITE, night * tw * 0.9);
        }
    }
    let orb_y = ORB_Y[g.theme_from] + (ORB_Y[g.theme] - ORB_Y[g.theme_from]) * m;
    let orb_x = w * 0.76;
    for (r, a) in [(58.0, 0.12), (46.0, 0.2)] { o.c(orb_x, orb_y, r, tc(4), a); }
    o.c(orb_x, orb_y, 28.0, tc(3), 1.0);
    if night > 0.01 { o.c(orb_x + 11.0, orb_y - 7.0, 23.0, tc(4), night); }

    let span = w + 220.0;
    for (cx, cy, s, v, d) in [(40.0, 96.0, 1.0, 7.0, 0.08), (250.0, 170.0, 0.7, 5.0, 0.06), (380.0, 64.0, 0.85, 9.0, 0.1), (150.0, 262.0, 0.55, 4.0, 0.05)] {
        let x = wrap(cx - g.time * v - g.scroll * d, span) - 110.0;
        for (px, py, r) in [(0.0f32, 0.0f32, 20.0f32), (24.0, -12.0, 25.0), (52.0, -4.0, 21.0), (74.0, 6.0, 15.0)] { o.c(x + px * s, cy + py * s, r * s, tc(7), 0.92); }
        o.r(x - 12.0 * s, cy, 98.0 * s, 22.0 * s, tc(7), 0.92);
    }

    // marshmallow hills: big overlapping circles, two parallax layers
    for (col, speed, r, base, step) in [(tc(5), 0.18, 120.0, FLOOR_Y + 40.0, 180.0), (tc(6), 0.42, 80.0, FLOOR_Y + 30.0, 120.0)] {
        let off = -wrap(g.scroll * speed, step);
        let mut x = off - step;
        let mut i = 0;
        while x < w + step {
            let bump = if i % 2 == 0 { 0.0 } else { 22.0 };
            o.c(x, base + bump, r, col, 1.0);
            x += step * 0.5;
            i += 1;
        }
    }

    let (line, cap, cap_shade, pa, pb) = (tc(10), tc(11), tc(12), tc(8), tc(9));
    for (idx, p) in g.pillars.iter().enumerate() {
        if !p.on { continue; }
        let (top, bot) = (p.gap_y - p.gap / 2.0, p.gap_y + p.gap / 2.0);
        for (y0, y1) in [(-40.0, top - CAP_H + 4.0), (bot + CAP_H - 4.0, FLOOR_Y + 10.0)] {
            o.r(p.x - PILLAR_W / 2.0 - 2.4, y0, PILLAR_W + 4.8, y1 - y0, line, 1.0);
            o.r(p.x - PILLAR_W / 2.0, y0, PILLAR_W * 0.5, y1 - y0, pa, 1.0);
            o.r(p.x, y0, PILLAR_W * 0.5, y1 - y0, mix(pa, pb, 0.7), 1.0);
            o.r(p.x - PILLAR_W / 2.0 + 9.0, y0, 9.0, y1 - y0, WHITE, 0.38);
        }
        for (cy, puff_y) in [(top - CAP_H, CAP_H - 3.0), (bot, 3.0)] {
            for (dy, col, grow) in [(0.0, line, 2.4), (0.0, cap_shade, 0.0), (-3.0, cap, 0.0)] {
                o.r(p.x - CAP_W / 2.0 + 12.0 - grow, cy + dy - grow, CAP_W - 24.0 + grow * 2.0, CAP_H + grow * 2.0, col, 1.0);
                o.c(p.x - CAP_W / 2.0 + 12.0, cy + dy + CAP_H / 2.0, CAP_H / 2.0 + grow, col, 1.0);
                o.c(p.x + CAP_W / 2.0 - 12.0, cy + dy + CAP_H / 2.0, CAP_H / 2.0 + grow, col, 1.0);
                for i in 0..4 { o.c(p.x - CAP_W / 2.0 + 12.0 + i as f32 * ((CAP_W - 24.0) / 3.0), cy + dy + puff_y, 11.0 + grow, col, 1.0); }
            }
        }
        if p.star == 1 {
            let sy = p.gap_y + p.star_dy + (g.time * 3.0 + idx as f32).sin() * 3.0;
            o.c(p.x, sy, 20.0, GOLD, 0.3);
            o.c(p.x, sy, 11.0, WHITE, 1.0);
            o.c(p.x, sy, 9.0, GOLD, 1.0);
        }
    }

    for (shift, dy, col) in [(-wrap(g.scroll * 0.75 + 14.0, 28.0), -8.0, tc(14)), (-wrap(g.scroll, 28.0), 4.0, tc(13))] {
        let mut x = shift - 28.0;
        while x < w + 28.0 { o.c(x, FLOOR_Y + 12.0 + dy, 17.0, col, 1.0); x += 28.0; }
        o.r(-20.0, FLOOR_Y + 12.0 + dy, w + 40.0, WORLD_H, col, 1.0);
    }

    for q in g.parts.iter() {
        if q.life <= 0.0 || q.kind == P_SPARK { continue; }
        let t = q.life / q.max;
        if q.kind == P_FLUFF { o.c(q.x, q.y, q.size * (1.6 - t * 0.6), WHITE, t * 0.9); }
        else if q.kind == P_FEATHER { o.c(q.x, q.y, q.size, SHADE, (t * 1.6).min(1.0)); }
    }

    // bird: rotation/squash applied to part offsets (circles need no rotation)
    let dead = g.phase == Phase::Dead;
    let sq = g.squash * g.squash;
    let (scx, scy) = (1.0 - 0.1 * sq, 1.0 + 0.13 * sq);
    let (rc, rs) = (g.rot.to_radians().cos(), g.rot.to_radians().sin());
    let bx = g.bird_x + sx;
    let by = g.y + sy;
    let at = |x: f32, y: f32| { let (x, y) = (x * scx, y * scy); (bx + x * rc - y * rs, by + x * rs + y * rc) };
    let mut fluff = vec![(0.0f32, 0.0f32, 14.0f32)];
    for i in 0..13 { let a = i as f32 / 13.0 * std::f32::consts::TAU; fluff.push((a.cos() * 12.0, a.sin() * 11.5, 6.2)); }
    fluff.push((-3.0, -18.0, 4.2));
    fluff.push((2.5, -19.5, 3.4));
    for &(x, y, r) in &fluff { let (px, py) = at(x, y); o.c(px, py, r + 2.2, LINE, 1.0); }
    for &(x, y, r) in &fluff { let (px, py) = at(x, y); o.c(px, py, r, SHADE, 1.0); }
    let (px, py) = at(-2.0, -3.0); o.c(px, py, 13.0, BODY, 1.0);
    for i in 0..5 { let (px, py) = at(-6.0 + i as f32 * 3.0, 6.5); o.c(px, py, 4.5, BELLY, 1.0); }
    let (px, py) = at(5.0, 5.5); o.c(px, py, 3.6, 0xFF8FB1, 0.55);
    let (px, py) = at(7.0, -5.0); o.c(px, py, 6.8, LINE, 1.0);
    if dead {
        let (px, py) = at(7.0, -5.0); o.c(px, py, 5.8, WHITE, 1.0);
        for i in -2..=2 { let (a, b) = at(7.0 + i as f32 * 1.4, -5.0 + i as f32 * 1.4); o.c(a, b, 1.0, INK, 1.0); let (a, b) = at(7.0 + i as f32 * 1.4, -5.0 - i as f32 * 1.4); o.c(a, b, 1.0, INK, 1.0); }
    } else {
        let bt = g.time % 3.7;
        let open = if bt < 0.12 { ((bt - 0.06).abs() / 0.06).max(0.3) } else { 1.0 };
        let (px, py) = at(7.0, -5.0); o.c(px, py, 5.8 * open, WHITE, 1.0);
        if open >= 1.0 { let (px, py) = at(8.6, -4.6); o.c(px, py, 3.3, INK, 1.0); let (px, py) = at(9.6, -6.1); o.c(px, py, 1.25, WHITE, 1.0); }
    }
    for (x, y, r, col) in [(16.0, 1.0, 5.6, LINE), (20.5, 1.2, 3.6, LINE), (16.0, 1.0, 4.4, BEAK), (20.0, 1.2, 2.6, BEAK)] { let (px, py) = at(x, y); o.c(px, py, r, col, 1.0); }
    let since = g.time - g.flap_at;
    let wing_a = if dead { -30.0f32 } else if since < 0.32 || g.vy < -60.0 { (g.time * 34.0).sin() * 32.0 - 8.0 } else { 8.0 + (g.time * 4.0).sin() * 4.0 };
    let (wc, ws) = (wing_a.to_radians().cos(), wing_a.to_radians().sin());
    for pass in 0..2 {
        for (dx, dy, r) in [(-2.0f32, 0.0f32, 8.0f32), (-9.0, 3.0, 4.5), (-4.0, 5.0, 4.5)] {
            let (wx, wy) = (-5.0 + dx * wc - dy * ws, 3.0 + dx * ws + dy * wc);
            let (px, py) = at(wx, wy);
            if pass == 0 { o.c(px, py, r + 1.9, LINE, 1.0); } else { o.c(px, py, r, WING, 1.0); }
        }
    }
    let _ = BIRD_R;

    for q in g.parts.iter() {
        if q.life <= 0.0 || q.kind != P_SPARK { continue; }
        let t = q.life / q.max;
        o.c(q.x, q.y, 4.0 * (0.5 + t), 0xFFF4B0, t);
    }
    if g.flash > 0.0 { o.r(-20.0, -20.0, w + 40.0, WORLD_H + 40.0, WHITE, g.flash * 0.55); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn draw_list_is_bounded() {
        let mut g = Game::new(360.0, 1234);
        g.bot = true;
        let mut out = Vec::new();
        let mut max = 0;
        for _ in 0..120 * 40 { g.tick(1.0 / 120.0); draw_list(&g, 360.0, &mut out); max = max.max(out.len()); }
        assert!(max > 100 && max < 700, "prims per frame: {max}");
    }
}
