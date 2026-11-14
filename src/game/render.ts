// Skia renderer. `makeResources` builds every path, paint and shader once (JS thread).
// `drawScene` is a worklet that records one frame from the game state on the UI thread.
import {
  BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode,
  type SkCanvas, type SkColor, type SkPaint, type SkPath, type SkShader,
} from '@shopify/react-native-skia';
import {
  CAP_H, CAP_W, DEAD, FLOOR_Y, P_FEATHER, P_FLUFF, P_SPARK, PARTICLES, PILLARS, PILLAR_W, WORLD_H,
  type GameState,
} from './engine';
import { SKINS, THEME_LIST } from './look';

const TILE = 360;
const FLOOR_TILE = 280;
const BODY_LEN = 1000;

type ThemeRes = {
  sky: SkShader;
  pillar: SkShader;
  orb: SkColor; orbGlow: SkColor; hillFar: SkColor; hillNear: SkColor; cloud: SkColor;
  pillarLine: SkColor; cap: SkColor; capShade: SkColor; floor: SkColor; floorShade: SkColor;
  orbY: number; moon: number;
};

type SkinRes = { body: SkShader; belly: SkColor; wing: SkColor; line: SkColor; beak: SkColor; feather: SkColor };

export type Resources = {
  themes: ThemeRes[];
  skins: SkinRes[];
  fill: SkPaint; // generic solid fill, colour set per draw
  shaded: SkPaint; // fill with shader
  stroke: SkPaint;
  glow: SkPaint;
  soft: SkPaint;
  softer: SkPaint;
  cloud: SkPath;
  hillFar: SkPath;
  hillNear: SkPath;
  body: SkPath;
  shine: SkPath;
  capTop: SkPath; // cap of the top pillar (puffs face down, toward the gap)
  capBot: SkPath;
  floorPuffs: SkPath;
  star: SkPath;
  fluff: SkPath;
  belly: SkPath;
  wing: SkPath;
  beak: SkPath;
  white: SkColor; ink: SkColor; gold: SkColor; blush: SkColor; flash: SkColor; spark: SkColor;
  starsXY: number[];
};

function union(build: (b: ReturnType<typeof Skia.PathBuilder.Make>) => void): SkPath {
  const b = Skia.PathBuilder.Make();
  build(b);
  const p = b.build();
  // Overlapping shapes are fine for fills; outlines are drawn stroke-first (see drawBird),
  // so a merged path is only an optimisation. CanvasKit (web) has no Simplify.
  try {
    return Skia.Path.Simplify(p) ?? p;
  } catch {
    return p;
  }
}

function wave(amp: number, base: number, phase: number, freq: number): SkPath {
  // rounded "marshmallow" hills: a sum of two sines, closed down to the bottom
  const b = Skia.PathBuilder.Make();
  b.moveTo(0, WORLD_H);
  for (let x = 0; x <= TILE; x += 6) {
    const t = (x / TILE) * Math.PI * 2;
    const y = base - amp * (0.55 + 0.3 * Math.sin(t * freq + phase) + 0.15 * Math.sin(t * freq * 2 + phase * 3));
    b.lineTo(x, y);
  }
  b.lineTo(TILE, WORLD_H);
  b.close();
  return b.build();
}

const C = (c: string) => Skia.Color(c);

export function makeResources(): Resources {
  const themes: ThemeRes[] = THEME_LIST.map((t) => ({
    sky: Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: FLOOR_Y }, t.sky.map(C), [0, 0.6, 1], TileMode.Clamp),
    pillar: Skia.Shader.MakeLinearGradient({ x: -PILLAR_W / 2, y: 0 }, { x: PILLAR_W / 2, y: 0 }, [C(t.pillar[0]), C(t.pillar[0]), C(t.pillar[1])], [0, 0.35, 1], TileMode.Clamp),
    orb: C(t.orb), orbGlow: C(t.orbGlow), hillFar: C(t.hillFar), hillNear: C(t.hillNear), cloud: C(t.cloud),
    pillarLine: C(t.pillarLine), cap: C(t.cap), capShade: C(t.capShade), floor: C(t.floor), floorShade: C(t.floorShade),
    orbY: t.orbY, moon: t.moon ? 1 : 0,
  }));
  const skins: SkinRes[] = SKINS.map((s) => ({
    body: Skia.Shader.MakeRadialGradient({ x: -5, y: -7 }, 26, [C(s.body), C(s.body), C(s.shade)], [0, 0.45, 1], TileMode.Clamp),
    belly: C(s.belly), wing: C(s.wing), line: C(s.line), beak: C(s.beak), feather: C(s.shade),
  }));

  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const shaded = Skia.Paint();
  shaded.setAntiAlias(true);
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeJoin(StrokeJoin.Round);
  stroke.setStrokeCap(StrokeCap.Round);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 16, true));
  const soft = Skia.Paint();
  soft.setAntiAlias(true);
  soft.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 1.6, true));
  const softer = Skia.Paint();
  softer.setAntiAlias(true);
  softer.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 5, true));

  const cloud = union((b) => {
    b.addCircle(0, 0, 20); b.addCircle(24, -12, 25); b.addCircle(52, -4, 21); b.addCircle(74, 6, 15);
    b.addRRect(Skia.RRectXY(Skia.XYWHRect(-12, 0, 98, 22), 11, 11));
  });

  const body = Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(-PILLAR_W / 2, 0, PILLAR_W, BODY_LEN), 12, 12));
  const shine = Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(-PILLAR_W / 2 + 9, 0, 9, BODY_LEN), 4.5, 4.5));
  // caps: a rounded bar with a row of puffs on the side that faces the gap
  const capWith = (puffY: number) => union((b) => {
    b.addRRect(Skia.RRectXY(Skia.XYWHRect(-CAP_W / 2, 0, CAP_W, CAP_H), 12, 12));
    for (let i = 0; i < 4; i++) b.addCircle(-CAP_W / 2 + 12 + i * ((CAP_W - 24) / 3), puffY, 11);
  });
  const capTop = capWith(CAP_H - 3); // drawn with its top at (gapTop - CAP_H)
  const capBot = capWith(3);

  const floorPuffs = union((b) => {
    for (let x = -14; x <= FLOOR_TILE + 14; x += 28) b.addCircle(x, FLOOR_Y + 12, 17);
    b.addRect(Skia.XYWHRect(-14, FLOOR_Y + 12, FLOOR_TILE + 28, WORLD_H - FLOOR_Y));
  });

  const sb = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 12 : 5.5;
    if (i === 0) sb.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sb.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sb.close();
  const star = sb.build();

  const fluff = union((b) => {
    b.addCircle(0, 0, 14);
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.addCircle(Math.cos(a) * 12, Math.sin(a) * 11.5, 6.2);
    }
    b.addCircle(-3, -18, 4.2); // tuft
    b.addCircle(2.5, -19.5, 3.4);
  });
  const belly = Skia.Path.Oval(Skia.XYWHRect(-9, 0, 19, 13));
  const wing = union((b) => {
    b.addOval(Skia.XYWHRect(-11, -6, 18, 12));
    b.addCircle(-9, 3, 4.5);
    b.addCircle(-4, 5, 4.5);
  });
  const beak = Skia.Path.MakeFromSVGString('M12.5 -3.5 Q24 -1 23 2 Q22 5 12.5 6 Z')!;

  const starsXY: number[] = [];
  for (let i = 0; i < 34; i++) starsXY.push((i * 97.3) % 520, 18 + ((i * 53.7) % 340), 0.8 + ((i * 7) % 3) * 0.55);

  return {
    themes, skins, fill, shaded, stroke, glow, soft, softer,
    cloud, hillFar: wave(78, FLOOR_Y - 10, 0.2, 2), hillNear: wave(52, FLOOR_Y + 8, 1.4, 3),
    body, shine, capTop, capBot, floorPuffs, star, fluff, belly, wing, beak,
    white: C('#FFFFFF'), ink: C('#3D2C4E'), gold: C('#FFD45C'), blush: C('#FF8FB1'), flash: C('#FFFFFF'), spark: C('#FFF4B0'),
    starsXY,
  };
}

function mix(a: SkColor, b: SkColor, t: number): SkColor {
  'worklet';
  if (t >= 1) return b;
  if (t <= 0) return a;
  return Float32Array.of(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1);
}

function wrap(v: number, m: number): number {
  'worklet';
  return ((v % m) + m) % m;
}

const CLOUDS = [
  // x, y, scale, speed(px/s), parallax depth
  40, 96, 1.0, 7, 0.08,
  250, 170, 0.7, 5, 0.06,
  380, 64, 0.85, 9, 0.1,
  150, 262, 0.55, 4, 0.05,
];

export function drawBird(c: SkCanvas, r: Resources, skin: number, x: number, y: number, rot: number, time: number, flapAt: number, squash: number, dead: boolean, vy: number): void {
  'worklet';
  const k = r.skins[skin] ?? r.skins[0];
  const p = r.fill;
  c.save();
  c.translate(x, y);
  c.rotate(rot, 0, 0);
  const sq = squash * squash;
  c.scale(1 - 0.1 * sq, 1 + 0.13 * sq);

  // body: outline first at double width, fill on top -> clean outer outline
  r.stroke.setColor(k.line);
  r.stroke.setStrokeWidth(4.4);
  c.drawPath(r.fluff, r.stroke);
  r.shaded.setShader(k.body);
  r.shaded.setAlphaf(1);
  c.drawPath(r.fluff, r.shaded);
  p.setColor(k.belly);
  p.setAlphaf(1);
  c.drawPath(r.belly, p);

  // cheek
  r.soft.setColor(r.blush);
  r.soft.setAlphaf(0.6);
  c.drawCircle(5, 5.5, 3.6, r.soft);

  // eye (blinks every few seconds)
  if (dead) {
    r.stroke.setColor(r.ink);
    r.stroke.setStrokeWidth(2.2);
    c.drawLine(4, -8, 10, -2, r.stroke);
    c.drawLine(10, -8, 4, -2, r.stroke);
  } else {
    const blinkT = time % 3.7;
    const open = blinkT < 0.12 ? Math.abs(blinkT - 0.06) / 0.06 : 1;
    c.save();
    c.translate(7, -5);
    c.scale(1, Math.max(0.12, open));
    p.setColor(r.white);
    c.drawCircle(0, 0, 5.8, p);
    r.stroke.setStrokeWidth(1.8);
    c.drawCircle(0, 0, 5.8, r.stroke);
    p.setColor(r.ink);
    c.drawCircle(1.6, 0.4, 3.3, p);
    p.setColor(r.white);
    c.drawCircle(2.6, -1.1, 1.25, p);
    c.restore();
  }

  // beak
  r.stroke.setColor(k.line);
  r.stroke.setStrokeWidth(3.2);
  c.drawPath(r.beak, r.stroke);
  p.setColor(k.beak);
  c.drawPath(r.beak, p);

  // wing: flutters fast right after a flap, glides otherwise
  const since = time - flapAt;
  const wingA = dead ? -30 : since < 0.32 || vy < -60 ? Math.sin(time * 34) * 32 - 8 : 8 + Math.sin(time * 4) * 4;
  c.save();
  c.translate(-5, 3);
  c.rotate(wingA, 2, -1);
  r.stroke.setStrokeWidth(3.8);
  c.drawPath(r.wing, r.stroke);
  p.setColor(k.wing);
  c.drawPath(r.wing, p);
  c.restore();

  c.restore();
}

/** Records one full frame. `vw`/`vh` are canvas size in pixels. */
export function drawScene(c: SkCanvas, s: GameState, r: Resources, skin: number, vw: number, vh: number): void {
  'worklet';
  const k = vh / WORLD_H;
  const w = vw / k;
  const from = r.themes[s.themeFrom];
  const to = r.themes[s.theme];
  const m = s.themeMix;
  const p = r.fill;

  c.save();
  c.scale(k, k);
  if (s.shake > 0) {
    const a = s.shake * s.shake * 7;
    c.translate(Math.sin(s.time * 91) * a, Math.cos(s.time * 77) * a);
  }

  // sky (crossfade between themes)
  r.shaded.setAlphaf(1);
  r.shaded.setShader(from.sky);
  c.drawRect({ x: -20, y: -20, width: w + 40, height: WORLD_H + 40 }, r.shaded);
  if (m < 1) {
    r.shaded.setShader(to.sky);
    r.shaded.setAlphaf(m);
    c.drawRect({ x: -20, y: -20, width: w + 40, height: WORLD_H + 40 }, r.shaded);
    r.shaded.setAlphaf(1);
  }

  // night stars
  const night = from.moon + (to.moon - from.moon) * m;
  if (night > 0.01) {
    p.setColor(r.white);
    for (let i = 0; i < r.starsXY.length; i += 3) {
      const tw = 0.55 + 0.45 * Math.sin(s.time * 2 + i);
      p.setAlphaf(night * tw * 0.9);
      c.drawCircle(r.starsXY[i] % w, r.starsXY[i + 1], r.starsXY[i + 2], p);
    }
    p.setAlphaf(1);
  }

  // sun / moon with a soft glow
  const orbY = from.orbY + (to.orbY - from.orbY) * m;
  const orbX = w * 0.76;
  r.glow.setColor(mix(from.orbGlow, to.orbGlow, m));
  r.glow.setAlphaf(0.75);
  c.drawCircle(orbX, orbY, 44, r.glow);
  p.setColor(mix(from.orb, to.orb, m));
  c.drawCircle(orbX, orbY, 28, p);
  if (night > 0.01) {
    // crescent: cover part of the orb with the glow colour
    p.setColor(mix(from.orbGlow, to.orbGlow, m));
    p.setAlphaf(night);
    c.drawCircle(orbX + 11, orbY - 7, 23, p);
    p.setAlphaf(1);
  }

  // drifting clouds (soft edges)
  const cloudCol = mix(from.cloud, to.cloud, m);
  r.soft.setColor(cloudCol);
  const span = w + 220;
  for (let i = 0; i < CLOUDS.length; i += 5) {
    const x = wrap(CLOUDS[i] - s.time * CLOUDS[i + 3] - s.scroll * CLOUDS[i + 4], span) - 110;
    c.save();
    c.translate(x, CLOUDS[i + 1]);
    c.scale(CLOUDS[i + 2], CLOUDS[i + 2]);
    r.soft.setAlphaf(0.92);
    c.drawPath(r.cloud, r.soft);
    c.restore();
  }

  // hills, two parallax layers
  const tiles = Math.ceil(w / TILE) + 1;
  p.setColor(mix(from.hillFar, to.hillFar, m));
  const far = -wrap(s.scroll * 0.18, TILE);
  for (let i = 0; i < tiles; i++) {
    c.save();
    c.translate(far + i * TILE, 0);
    c.drawPath(r.hillFar, p);
    c.restore();
  }
  p.setColor(mix(from.hillNear, to.hillNear, m));
  const near = -wrap(s.scroll * 0.42, TILE);
  for (let i = 0; i < tiles; i++) {
    c.save();
    c.translate(near + i * TILE, 0);
    c.drawPath(r.hillNear, p);
    c.restore();
  }

  // pillars
  const line = mix(from.pillarLine, to.pillarLine, m);
  const cap = mix(from.cap, to.cap, m);
  const capShade = mix(from.capShade, to.capShade, m);
  for (let i = 0; i < PILLARS; i++) {
    const pl = s.pillars[i];
    if (!pl.on) continue;
    const top = pl.gapY - pl.gap / 2;
    const bot = pl.gapY + pl.gap / 2;
    c.save();
    c.translate(pl.x, 0);
    for (let half = 0; half < 2; half++) {
      const y0 = half === 0 ? top - CAP_H + 4 - BODY_LEN : bot + CAP_H - 4;
      c.save();
      c.translate(0, y0);
      r.shaded.setShader(from.pillar);
      r.shaded.setAlphaf(1);
      c.drawPath(r.body, r.shaded);
      if (m < 1) {
        r.shaded.setShader(to.pillar);
        r.shaded.setAlphaf(m);
        c.drawPath(r.body, r.shaded);
        r.shaded.setAlphaf(1);
      }
      p.setColor(r.white);
      p.setAlphaf(0.38);
      c.drawPath(r.shine, p);
      p.setAlphaf(1);
      r.stroke.setColor(line);
      r.stroke.setStrokeWidth(2.4);
      c.drawPath(r.body, r.stroke);
      c.restore();
    }
    // caps
    const capY0 = top - CAP_H;
    r.stroke.setStrokeWidth(4.8);
    for (let half = 0; half < 2; half++) {
      const capPath = half === 0 ? r.capTop : r.capBot;
      c.save();
      c.translate(0, half === 0 ? capY0 : bot);
      c.drawPath(capPath, r.stroke);
      p.setColor(capShade);
      c.drawPath(capPath, p);
      c.translate(0, -3);
      p.setColor(cap);
      c.drawPath(capPath, p);
      c.restore();
    }

    // collectible star
    if (pl.star === 1) {
      const sy = pl.gapY + pl.starDy + Math.sin(s.time * 3 + i) * 3;
      r.glow.setColor(r.gold);
      r.glow.setAlphaf(0.55);
      c.drawCircle(0, sy, 16, r.glow);
      c.save();
      c.translate(0, sy);
      c.rotate(Math.sin(s.time * 2.4 + i) * 14, 0, 0);
      p.setColor(r.gold);
      c.drawPath(r.star, p);
      r.stroke.setColor(r.white);
      r.stroke.setStrokeWidth(2);
      c.drawPath(r.star, r.stroke);
      c.restore();
    }
    c.restore();
  }

  // fluffy cloud floor, two layers
  const fTiles = Math.ceil(w / FLOOR_TILE) + 1;
  p.setColor(mix(from.floorShade, to.floorShade, m));
  const fb = -wrap(s.scroll * 0.75 + 14, FLOOR_TILE);
  for (let i = 0; i < fTiles; i++) {
    c.save();
    c.translate(fb + i * FLOOR_TILE, -8);
    c.drawPath(r.floorPuffs, p);
    c.restore();
  }
  p.setColor(mix(from.floor, to.floor, m));
  const ff = -wrap(s.scroll, FLOOR_TILE);
  for (let i = 0; i < fTiles; i++) {
    c.save();
    c.translate(ff + i * FLOOR_TILE, 4);
    c.drawPath(r.floorPuffs, p);
    c.restore();
  }

  // bird shadow on the floor (skin < 0 = no bird, used for backdrops)
  if (skin >= 0) {
  const h = Math.max(0, Math.min(1, (FLOOR_Y - s.y) / 300));
  r.softer.setColor(r.ink);
  r.softer.setAlphaf(0.16 * (1 - h * 0.7));
  c.save();
  c.translate(s.birdX, FLOOR_Y + 10);
  c.scale(1 - h * 0.5, 0.28);
  c.drawCircle(0, 0, 18, r.softer);
  c.restore();
  }

  // particles behind the bird
  for (let i = 0; i < PARTICLES; i++) {
    const q = s.parts[i];
    if (q.life <= 0 || q.kind === P_SPARK) continue;
    const t = q.life / q.max;
    if (q.kind === P_FLUFF) {
      p.setColor(r.white);
      p.setAlphaf(t * 0.9);
      c.drawCircle(q.x, q.y, q.size * (1.6 - t * 0.6), p);
    } else if (q.kind === P_FEATHER) {
      p.setColor(r.skins[skin]?.feather ?? r.white);
      p.setAlphaf(Math.min(1, t * 1.6));
      c.save();
      c.translate(q.x, q.y);
      c.rotate(q.x * 3, 0, 0);
      c.scale(1.6, 0.7);
      c.drawCircle(0, 0, q.size, p);
      c.restore();
    }
  }
  p.setAlphaf(1);

  if (skin >= 0) drawBird(c, r, skin, s.birdX, s.y, s.rot, s.time, s.flapAt, s.squash, s.phase === DEAD, s.vy);

  // sparkles in front
  for (let i = 0; i < PARTICLES; i++) {
    const q = s.parts[i];
    if (q.life <= 0 || q.kind !== P_SPARK) continue;
    const t = q.life / q.max;
    p.setColor(r.spark);
    p.setAlphaf(t);
    c.save();
    c.translate(q.x, q.y);
    c.rotate(s.time * 200 + i * 40, 0, 0);
    c.scale(0.45 * (0.5 + t), 0.45 * (0.5 + t));
    c.drawPath(r.star, p);
    c.restore();
  }
  p.setAlphaf(1);
  c.restore();

  if (s.flash > 0) {
    p.setColor(r.flash);
    p.setAlphaf(s.flash * 0.55);
    c.drawRect({ x: 0, y: 0, width: vw, height: vh }, p);
    p.setAlphaf(1);
  }
}

let shared: Resources | null = null;
/** Resources are built once and shared by every canvas (game, menu, icons). */
export function getResources(): Resources {
  if (!shared) shared = makeResources();
  return shared;
}
